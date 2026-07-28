const { getDb } = require('../db');
const { logSync } = require('./logger');

/**
 * Conflict policy:
 * - Pull: server-authoritative for already-synced rows.
 * - Pending local writes are preserved; flagged as conflict if server changed same row.
 * - Push: last-write-wins by updated_at timestamp on local row.
 */
function shouldServerWinOnPull(localRow, serverUpdatedAt) {
  if (!localRow) return true;
  if (localRow.sync_status === 'pending') {
    const localUpdated = localRow.updated_at ? Date.parse(localRow.updated_at) : 0;
    const serverUpdated = serverUpdatedAt ? Date.parse(serverUpdatedAt) : Date.now();
    if (serverUpdated > localUpdated) {
      logSync('pull', 'conflict', 'Server newer than pending local write', {
        local_uuid: localRow.local_uuid,
        entity: localRow.entity || 'unknown',
      });
      return false;
    }
    return false;
  }
  return true;
}

function markConflict(localUuid, reason) {
  getDb().prepare(
    `UPDATE sync_queue SET sync_status = 'conflict', last_error = ?, updated_at = datetime('now')
     WHERE local_uuid = ?`
  ).run(reason, localUuid);
}

function resolvePushConflict(localRow, serverRow) {
  const localTs = localRow.updated_at ? Date.parse(localRow.updated_at) : 0;
  const serverTs = serverRow?.updated_at ? Date.parse(serverRow.updated_at) : 0;
  return localTs >= serverTs ? 'local' : 'server';
}

module.exports = {
  shouldServerWinOnPull,
  markConflict,
  resolvePushConflict,
};
