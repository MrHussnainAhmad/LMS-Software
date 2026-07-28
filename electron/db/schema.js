/** Local SQLite schema version — bump when entity shapes change. */
const SCHEMA_VERSION = 1;

/** Expected field fingerprints per entity (used before push). */
const ENTITY_FINGERPRINTS = {
  students: 'id,name,loginRollNumber,classRollNumber,className,sectionName',
  staff: 'id,name,email',
  campuses: 'id,name',
  announcements: 'id,title,content',
};

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS _sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS _table_sync_state (
    table_name TEXT PRIMARY KEY,
    last_synced_at TEXT,
    record_count INTEGER DEFAULT 0,
    schema_fingerprint TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_uuid TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    operation TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    server_id INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_offline_at TEXT NOT NULL,
    source_device_id TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    campus_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS students (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER UNIQUE,
    campus_id INTEGER,
    name TEXT,
    father_name TEXT,
    gender TEXT,
    login_roll_number TEXT,
    class_roll_number TEXT,
    profile_picture_url TEXT,
    emergency_contact TEXT,
    parental_whatsapp TEXT,
    year_of_joining INTEGER,
    phone TEXT,
    age INTEGER,
    class_id INTEGER,
    section_id INTEGER,
    class_name TEXT,
    section_name TEXT,
    campus_name TEXT,
    status TEXT,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    server_updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER UNIQUE,
    campus_id INTEGER,
    name TEXT,
    email TEXT,
    phone TEXT,
    role_id INTEGER,
    role_name TEXT,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    server_updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS campuses (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER UNIQUE,
    name TEXT,
    address TEXT,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    server_updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER UNIQUE,
    title TEXT,
    content TEXT,
    target_type TEXT,
    target_class_id INTEGER,
    target_campus_id INTEGER,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    server_updated_at TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS batch_exams (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER UNIQUE,
    title TEXT,
    class_id INTEGER,
    section_id INTEGER,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    server_updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS staff_attendance (
    local_uuid TEXT PRIMARY KEY,
    server_id INTEGER,
    staff_id INTEGER,
    staff_server_id INTEGER,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    created_offline_at TEXT,
    source_device_id TEXT,
    updated_at TEXT,
    UNIQUE(staff_server_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS institution_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload_json TEXT NOT NULL,
    updated_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'synced'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_students_server_id ON students(server_id)`,
  `CREATE INDEX IF NOT EXISTS idx_students_deleted ON students(is_deleted)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_server_id ON staff(server_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status)`,
];

module.exports = {
  SCHEMA_VERSION,
  ENTITY_FINGERPRINTS,
  CREATE_STATEMENTS,
};
