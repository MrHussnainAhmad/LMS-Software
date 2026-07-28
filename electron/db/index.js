const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { CREATE_STATEMENTS, SCHEMA_VERSION } = require('./schema');

let db = null;

function getDbPath() {
  return path.join(app.getPath('userData'), 'nisaab360-local.sqlite');
}

function deleteDbFiles(basePath) {
  const candidates = [basePath, `${basePath}-wal`, `${basePath}-shm`];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // Best-effort cleanup; ignore if file is locked/missing.
    }
  }
}

function openAndInitDb(filePath) {
  const instance = new Database(filePath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  for (const statement of CREATE_STATEMENTS) {
    instance.exec(statement);
  }
  return instance;
}

function getMeta(key) {
  const row = getDb().prepare('SELECT value FROM _meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  getDb().prepare(
    'INSERT INTO _meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function initDatabase() {
  if (db) return db;

  const dbPath = getDbPath();
  const appVersion = app.getVersion();
  db = openAndInitDb(dbPath);

  const storedAppVersion = db.prepare('SELECT value FROM _meta WHERE key = ?').get('app_version')?.value || null;
  if (storedAppVersion && storedAppVersion !== appVersion) {
    db.close();
    db = null;
    deleteDbFiles(dbPath);
    db = openAndInitDb(dbPath);
    db.prepare(
      'INSERT INTO _meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('session_reset_required', '1');
  }

  const storedVersion = Number(getMeta('schema_version') || 0);
  if (storedVersion !== SCHEMA_VERSION) {
    setMeta('schema_version', SCHEMA_VERSION);
    setMeta('schema_migrated_at', new Date().toISOString());
  }
  setMeta('app_version', appVersion);

  return db;
}

function getDb() {
  if (!db) return initDatabase();
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  getMeta,
  setMeta,
  getDbPath,
};
