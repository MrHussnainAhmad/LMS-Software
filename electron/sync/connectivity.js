const { net } = require('electron');
const { setOnlineStatus } = require('./engine');
const { logSync } = require('./logger');
const { API_BASE_URL } = require('../config');
const { getMeta } = require('../db');

let lastOnline = null;
let pollId = null;
let probeRunning = false;
let offlineDelayMs = 5_000;

const ONLINE_PROBE_MS = 30_000;
const UNAUTHENTICATED_PROBE_MS = 60_000;
const MAX_OFFLINE_PROBE_MS = 60_000;

function checkConnectivity() {
  if (lastOnline === null) {
    const initial = net.isOnline();
    lastOnline = initial;
    setOnlineStatus(initial);
  }
  return Boolean(lastOnline);
}

async function probeInternet() {
  if (!net.isOnline()) return false;
  // The login request itself proves reachability. Do not generate backend health
  // traffic while the desktop app is merely sitting on its login screen.
  if (!getMeta('auth_token')) return true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkConnectivityProbe() {
  if (probeRunning) return lastOnline ?? false;
  probeRunning = true;
  try {
    const online = await probeInternet();
    if (lastOnline !== online) {
      lastOnline = online;
      setOnlineStatus(online);
      logSync(online ? 'push' : 'pull', online ? 'online' : 'offline', `Connectivity changed: ${online ? 'online' : 'offline'}`);
    }
    offlineDelayMs = online ? 5_000 : Math.min(offlineDelayMs * 2, MAX_OFFLINE_PROBE_MS);
    return online;
  } finally {
    probeRunning = false;
  }
}

function startConnectivityMonitor() {
  if (pollId) clearTimeout(pollId);

  const scheduleNext = () => {
    const delay = !getMeta('auth_token')
      ? UNAUTHENTICATED_PROBE_MS
      : lastOnline === false
        ? offlineDelayMs
        : ONLINE_PROBE_MS;
    pollId = setTimeout(async () => {
      await checkConnectivityProbe().catch(() => {});
      scheduleNext();
    }, delay);
  };

  checkConnectivityProbe().catch(() => {}).finally(scheduleNext);
}

function stopConnectivityMonitor() {
  if (pollId) clearTimeout(pollId);
  pollId = null;
}

module.exports = { startConnectivityMonitor, stopConnectivityMonitor, checkConnectivity };
