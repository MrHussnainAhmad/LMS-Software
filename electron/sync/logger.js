const { getDb } = require('../db');

function logSync(direction, status, message, details) {
  getDb().prepare(
    `INSERT INTO _sync_log(direction, status, message, details, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(
    direction,
    status,
    message,
    details ? JSON.stringify(details) : null
  );
}

function getRecentLogs(limit = 100) {
  return getDb().prepare(
    `SELECT id, direction, status, message, details, created_at
     FROM _sync_log ORDER BY id DESC LIMIT ?`
  ).all(limit);
}

module.exports = { logSync, getRecentLogs };
