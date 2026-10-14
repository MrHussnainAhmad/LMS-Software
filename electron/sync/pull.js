const { randomUUID } = require('crypto');
const { getDb, setMeta } = require('../db');
const { ENTITY_FINGERPRINTS, SCHEMA_VERSION } = require('../db/schema');
const { remoteRequest } = require('./remote');
const { logSync } = require('./logger');
const { shouldServerWinOnPull } = require('./conflicts');

function setCache(key, data, campusId) {
  getDb().prepare(
    `INSERT INTO api_cache(cache_key, response_json, fetched_at, campus_id)
     VALUES(?, ?, datetime('now'), ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       response_json = excluded.response_json,
       fetched_at = excluded.fetched_at,
       campus_id = excluded.campus_id`
  ).run(key, JSON.stringify(data), campusId || null);
}

function updateTableSyncState(tableName, count, fingerprint) {
  getDb().prepare(
    `INSERT INTO _table_sync_state(table_name, last_synced_at, record_count, schema_fingerprint)
     VALUES(?, datetime('now'), ?, ?)
     ON CONFLICT(table_name) DO UPDATE SET
       last_synced_at = excluded.last_synced_at,
       record_count = excluded.record_count,
       schema_fingerprint = excluded.schema_fingerprint`
  ).run(tableName, count, fingerprint || null);
}

function validatePullShape(entityType, rows) {
  const fingerprint = ENTITY_FINGERPRINTS[entityType];
  if (!fingerprint || !Array.isArray(rows) || rows.length === 0) return true;
  const required = fingerprint.split(',');
  const sample = rows[0];
  const missing = required.filter((field) => !(field in sample));
  if (missing.length > 0) {
    logSync('pull', 'warning', `Schema drift for ${entityType} (pull continues)`, { missing, schemaVersion: SCHEMA_VERSION });
  }
  return true;
}

function upsertStudent(row) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM students WHERE server_id = ?').get(row.id);
  if (existing && !shouldServerWinOnPull(existing, row.updatedAt || row.updated_at)) {
    return;
  }

  const localUuid = existing?.local_uuid || randomUUID();
  const resolvedProfilePicture =
    row.profilePictureUrl ||
    row.profilePicture ||
    row.profile_picture_url ||
    row.imageUrl ||
    row.imageURL ||
    null;

  db.prepare(
    `INSERT INTO students(
      local_uuid, server_id, campus_id, name, father_name, gender, login_roll_number,
      class_roll_number, profile_picture_url, emergency_contact, parental_whatsapp,
      year_of_joining, phone, age, class_name, section_name, campus_name, status,
      payload_json, is_deleted, sync_status, updated_at, server_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', datetime('now'), datetime('now'))
    ON CONFLICT(local_uuid) DO UPDATE SET
      server_id = excluded.server_id,
      campus_id = excluded.campus_id,
      name = excluded.name,
      father_name = excluded.father_name,
      gender = excluded.gender,
      login_roll_number = excluded.login_roll_number,
      class_roll_number = excluded.class_roll_number,
      profile_picture_url = excluded.profile_picture_url,
      emergency_contact = excluded.emergency_contact,
      parental_whatsapp = excluded.parental_whatsapp,
      year_of_joining = excluded.year_of_joining,
      phone = excluded.phone,
      age = excluded.age,
      class_name = excluded.class_name,
      section_name = excluded.section_name,
      campus_name = excluded.campus_name,
      status = excluded.status,
      payload_json = excluded.payload_json,
      server_updated_at = datetime('now'),
      updated_at = CASE WHEN students.sync_status = 'pending' THEN students.updated_at ELSE datetime('now') END`
  ).run(
    localUuid,
    row.id,
    row.campusId || null,
    row.name,
    row.fatherName || null,
    row.gender || null,
    row.loginRollNumber || null,
    row.classRollNumber || null,
    resolvedProfilePicture,
    row.emergencyContact || null,
    row.parentalWhatsapp || null,
    row.yearOfJoining || null,
    row.phone || null,
    row.age || null,
    row.className || null,
    row.sectionName || null,
    row.campusName || null,
    row.status || 'Enrolled',
    JSON.stringify(row)
  );
}

function upsertStaff(row) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM staff WHERE server_id = ?').get(row.id);
  if (existing && !shouldServerWinOnPull(existing, row.updatedAt)) return;

  const localUuid = existing?.local_uuid || randomUUID();
  db.prepare(
    `INSERT INTO staff(local_uuid, server_id, campus_id, name, email, phone, role_id, role_name, payload_json, is_deleted, sync_status, updated_at, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', datetime('now'), datetime('now'))
     ON CONFLICT(local_uuid) DO UPDATE SET
       campus_id = excluded.campus_id,
       name = excluded.name,
       email = excluded.email,
       phone = excluded.phone,
       role_id = excluded.role_id,
       role_name = excluded.role_name,
       payload_json = excluded.payload_json,
       server_updated_at = datetime('now'),
       updated_at = CASE WHEN staff.sync_status = 'pending' THEN staff.updated_at ELSE datetime('now') END`
  ).run(
    localUuid,
    row.id,
    row.campusId || row.campus_id || null,
    row.name,
    row.email || null,
    row.phone || null,
    row.roleId || row.customRoleId || null,
    row.roleName || row.role || null,
    JSON.stringify(row)
  );
}

function upsertCampus(row) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM campuses WHERE server_id = ?').get(row.id);
  if (existing && !shouldServerWinOnPull(existing, row.updatedAt)) return;

  const localUuid = existing?.local_uuid || randomUUID();
  db.prepare(
    `INSERT INTO campuses(local_uuid, server_id, name, address, payload_json, is_deleted, sync_status, updated_at, server_updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 'synced', datetime('now'), datetime('now'))
     ON CONFLICT(local_uuid) DO UPDATE SET
       name = excluded.name,
       address = excluded.address,
       payload_json = excluded.payload_json,
       server_updated_at = datetime('now'),
       updated_at = CASE WHEN campuses.sync_status = 'pending' THEN campuses.updated_at ELSE datetime('now') END`
  ).run(localUuid, row.id, row.name, row.address || null, JSON.stringify(row));
}

function upsertAnnouncement(row) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM announcements WHERE server_id = ?').get(row.id);
  if (existing && !shouldServerWinOnPull(existing, row.createdAt)) return;

  const localUuid = existing?.local_uuid || randomUUID();
  db.prepare(
    `INSERT INTO announcements(local_uuid, server_id, title, content, target_type, target_class_id, target_campus_id, payload_json, is_deleted, sync_status, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', datetime('now'), ?)
     ON CONFLICT(local_uuid) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       target_type = excluded.target_type,
       target_class_id = excluded.target_class_id,
       target_campus_id = excluded.target_campus_id,
       payload_json = excluded.payload_json,
       created_at = excluded.created_at,
       updated_at = CASE WHEN announcements.sync_status = 'pending' THEN announcements.updated_at ELSE datetime('now') END`
  ).run(
    localUuid,
    row.id,
    row.title,
    row.content,
    row.targetType || null,
    row.targetClassId || null,
    row.targetCampusId || null,
    JSON.stringify(row),
    row.createdAt || null
  );
}

async function fetchIdCardRows(token, students) {
  const ids = (students || [])
    .map((row) => Number(row?.id))
    .filter((id) => Number.isInteger(id));
  if (ids.length === 0) return { institution: null, students: [] };

  const chunks = [];
  for (let i = 0; i < ids.length; i += 200) {
    chunks.push(ids.slice(i, i + 200));
  }

  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await remoteRequest('GET', `/institution/students/id-cards?studentIds=${chunk.join(',')}`, undefined, token);
      } catch {
        return null;
      }
    })
  );

  let institution = null;
  const mergedStudents = [];
  for (const res of responses) {
    if (!res) continue;
    if (!institution && res.institution) institution = res.institution;
    if (Array.isArray(res.students)) mergedStudents.push(...res.students);
  }

  return { institution, students: mergedStudents };
}

async function pullAll(token) {
  logSync('pull', 'started', 'Full institution pull started');
  setMeta('auth_token', token);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const endpoints = [
      ['GET', '/institution/campuses', 'campuses'],
      ['GET', '/institution/students/picker?limit=100', 'students'],
      ['GET', '/institution/staff', 'staff'],
      ['GET', '/institution/announcements', 'announcements'],
      ['GET', '/institution/dashboard', 'dashboard'],
      ['GET', '/institution/dashboard/charts', 'charts'],
      ['GET', '/institution/settings', 'settings'],
      ['GET', '/institution/batch-exams', 'batch-exams'],
      ['GET', '/institution/timetable?metadata=true', 'timetable-meta'],
      ['GET', '/institution/timetable', 'timetable'],
      ['GET', '/institution/roles', 'roles'],
      ['GET', '/institution/admins', 'admins'],
      ['GET', `/institution/staff-attendance?date=${today}`, 'staff-attendance'],
      ['GET', '/institution/leaves?status=PENDING', 'leaves-pending'],
      ['GET', '/institution/exams', 'exams'],
      ['GET', '/institution/tickets?filter=open', 'tickets'],
      ['GET', '/institution/settings/grading', 'grading'],
    ];

    // Seed core offline data with bounded parallelism. Live-only settings and
    // OAuth connect URLs are loaded only when their screens need them.
    const results = [];
    for (let start = 0; start < endpoints.length; start += 4) {
      const batch = await Promise.all(endpoints.slice(start, start + 4).map(async ([method, path]) => {
        try {
          const data = await remoteRequest(method, path, undefined, token);
          return { path, data };
        } catch {
          return { path, data: null };
        }
      }));
      results.push(...batch);
    }

    const byPath = Object.fromEntries(results.map((r) => [r.path, r.data]));
    const campusesRes = byPath['/institution/campuses'] || { campuses: [] };
    const studentsRes = byPath['/institution/students/picker?limit=100'] || { students: [] };
    const staffRes = byPath['/institution/staff'] || { staff: [] };
    const announcementsRes = byPath['/institution/announcements'] || { announcements: [] };
    const dashboardRes = byPath['/institution/dashboard'] || {};
    const chartsRes = byPath['/institution/dashboard/charts'] || {};
    const settingsRes = byPath['/institution/settings'] || {};
    const batchExamsRes = byPath['/institution/batch-exams'] || { batchExams: [] };
    const timetableMetaRes = byPath['/institution/timetable?metadata=true'] || {};

    const campuses = campusesRes?.campuses || [];
    const students = studentsRes?.students || [];
    const staff = staffRes?.staff || [];
    const announcements = announcementsRes?.announcements || [];
    const idCardsRes = await fetchIdCardRows(token, students);
    const pickerById = new Map(students.map((row) => [Number(row?.id), row]));
    const idCardStudents = Array.isArray(idCardsRes?.students) ? idCardsRes.students : [];

    if (!validatePullShape('campuses', campuses)) {
      logSync('pull', 'warning', 'Campus validation skipped');
    }
    if (!validatePullShape('students', students)) {
      logSync('pull', 'warning', 'Student validation skipped');
    }
    if (!validatePullShape('staff', staff)) {
      logSync('pull', 'warning', 'Staff validation skipped');
    }

    const tx = getDb().transaction(() => {
      for (const row of campuses) upsertCampus(row);
      for (const row of students) upsertStudent(row);
      for (const row of idCardStudents) {
        const base = pickerById.get(Number(row?.id)) || {};
        upsertStudent({ ...base, ...row });
      }
      for (const row of staff) upsertStaff(row);
      for (const row of announcements) upsertAnnouncement(row);

      setCache('GET:/institution/dashboard', dashboardRes, null);
      setCache('GET:/institution/dashboard/charts', chartsRes, null);
      setCache('GET:/institution/settings', settingsRes, null);
      setCache('GET:/institution/batch-exams', batchExamsRes, null);
      setCache('GET:/institution/timetable?metadata=true', timetableMetaRes, null);

      for (const { path, data } of results) {
        if (data) setCache(`GET:${path}`, data, null);
      }
      if (idCardStudents.length > 0) {
        setCache('GET:/institution/students/id-cards', {
          institution: idCardsRes?.institution || settingsRes || {},
          students: idCardStudents,
        }, null);
      }

      getDb().prepare(
        `INSERT INTO institution_profile(id, payload_json, updated_at, sync_status)
         VALUES (1, ?, datetime('now'), 'synced')
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = datetime('now')`
      ).run(JSON.stringify(settingsRes || {}));

      updateTableSyncState('students', students.length, ENTITY_FINGERPRINTS.students);
      updateTableSyncState('staff', staff.length, ENTITY_FINGERPRINTS.staff);
      updateTableSyncState('campuses', campuses.length, ENTITY_FINGERPRINTS.campuses);
      updateTableSyncState('announcements', announcements.length, ENTITY_FINGERPRINTS.announcements);
    });

    tx();
    setMeta('last_full_pull_at', new Date().toISOString());
    logSync('pull', 'success', 'Full institution pull completed', {
      students: students.length,
      staff: staff.length,
      campuses: campuses.length,
    });
    return { success: true };
  } catch (error) {
    logSync('pull', 'failed', error.message, { stack: error.stack });
    throw error;
  }
}

async function pullStudents(token) {
  const studentsRes = await remoteRequest('GET', '/institution/students/picker?limit=100', undefined, token);
  const students = studentsRes?.students || [];
  const idCardsRes = await fetchIdCardRows(token, students);
  const pickerById = new Map(students.map((row) => [Number(row?.id), row]));
  const detailedRows = Array.isArray(idCardsRes?.students) ? idCardsRes.students : [];

  const tx = getDb().transaction(() => {
    for (const row of students) upsertStudent(row);
    for (const row of detailedRows) {
      const base = pickerById.get(Number(row?.id)) || {};
      upsertStudent({ ...base, ...row });
    }
    setCache('GET:/institution/students/picker?limit=100', studentsRes, null);
    if (detailedRows.length > 0) {
      setCache('GET:/institution/students/id-cards', {
        institution: idCardsRes?.institution || {},
        students: detailedRows,
      }, null);
    }
    updateTableSyncState('students', students.length, ENTITY_FINGERPRINTS.students);
  });
  tx();
  setMeta('last_students_pull_at', new Date().toISOString());
  logSync('pull', 'success', 'Student register refreshed', { students: students.length });
  return { success: true, students: students.length };
}

module.exports = {
  pullAll,
  pullStudents,
  setCache,
  upsertStudent,
  upsertStaff,
  upsertCampus,
  upsertAnnouncement,
  validatePullShape,
  updateTableSyncState,
};
