const { getDb } = require('../db');

function logSync(direction, status, message, details) {
  const db = getDb();
  db.prepare(
    `INSERT INTO _sync_log(direction, status, message, details, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(
    direction,
    status,
    message,
    details ? JSON.stringify(details) : null
  );

  // Keep only the last 500 logs to prevent infinite SQLite file bloat and RAM usage
  db.prepare(`
    DELETE FROM _sync_log WHERE id NOT IN (
      SELECT id FROM _sync_log ORDER BY id DESC LIMIT 500
    )
  `).run();
}

function getRecentLogs(limit = 100) {
  return getDb().prepare(
    `SELECT id, direction, status, message, details, created_at
     FROM _sync_log ORDER BY id DESC LIMIT ?`
  ).all(limit);
}

module.exports = { logSync, getRecentLogs };
