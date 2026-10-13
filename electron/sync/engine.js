const { getDb } = require('../db');
const { pullAll } = require('./pull');
const { pushPendingBatch } = require('./push');
const { logSync } = require('./logger');
const { getMeta, setMeta } = require('../db');

let online = true;
let pushTimer = null;
let running = false;
const FULL_PULL_FRESH_MS = 15 * 60 * 1000;

function getTokenIdentity(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    const userId = payload.userId ?? payload.sub;
    if (!userId || !payload.role) return null;
    return `${payload.role}:${userId}:${payload.institutionId ?? ''}`;
  } catch {
    return null;
  }
}

function isRecent(timestamp, maxAgeMs) {
  const value = timestamp ? new Date(timestamp).getTime() : Number.NaN;
  return Number.isFinite(value) && Date.now() - value >= 0 && Date.now() - value < maxAgeMs;
}

function setOnlineStatus(status) {
  online = status;
  setMeta('is_online', status ? '1' : '0');
  if (status) schedulePushSoon();
}

function schedulePushSoon() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    runPushCycle().catch((err) => logSync('push', 'failed', err.message));
  }, 1500);
}

async function runPushCycle() {
  if (!online || running) return;
  const token = getMeta('auth_token');
  if (!token) return;
  running = true;
  try {
    await pushPendingBatch(token);
  } finally {
    running = false;
  }
}

async function runInitialSync(token) {
  setMeta('auth_token', token);
  const identity = getTokenIdentity(token);
  const sameAccount = Boolean(identity) && getMeta('sync_identity') === identity;
  if (sameAccount && isRecent(getMeta('last_full_pull_at'), FULL_PULL_FRESH_MS)) {
    logSync('pull', 'skipped', 'Recent local data reused after login');
    if (online) await pushPendingBatch(token);
    return { success: true, skipped: true };
  }

  await pullAll(token);
  if (identity) setMeta('sync_identity', identity);
  if (online) await pushPendingBatch(token);
  return { success: true };
}

async function runMidnightPull() {
  const token = getMeta('auth_token');
  if (!token) return;
  const lastFullPullAt = getMeta('last_full_pull_at');

  // Avoid unwanted recurring full pulls; keep midnight cycle focused on pushing local pending writes.
  if (lastFullPullAt) {
    logSync('pull', 'skipped', 'Midnight full pull skipped (local-first mode enabled)');
    if (online) await pushPendingBatch(token);
    return;
  }

  logSync('pull', 'started', 'Scheduled midnight pull (first-time cache seed)');
  try {
    await pullAll(token);
    if (online) await pushPendingBatch(token);
  } catch (error) {
    logSync('pull', 'failed', `Midnight pull failed: ${error.message}`);
  }
}

function getSyncStatus() {
  const db = getDb();
  const pendingCount = db.prepare(`SELECT COUNT(*) AS count FROM sync_queue WHERE sync_status = 'pending'`).get().count;
  const tableStates = db.prepare(`SELECT table_name, last_synced_at, record_count FROM _table_sync_state`).all();
  return {
    online,
    pendingCount,
    lastFullPullAt: getMeta('last_full_pull_at'),
    lastPushAt: getMeta('last_push_at'),
    pushBlockedReason: getMeta('push_blocked_reason') || null,
    tableStates,
  };
}

module.exports = {
  setOnlineStatus,
  schedulePushSoon,
  runPushCycle,
  runInitialSync,
  runMidnightPull,
  getSyncStatus,
};
