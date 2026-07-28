const { setCache, upsertStudent, upsertStaff, upsertCampus } = require('./pull');

function isEmptyLocalResponse(data) {
  if (!data || typeof data !== 'object') return true;
  if (Array.isArray(data)) return data.length === 0;
  if (Array.isArray(data.campuses)) return data.campuses.length === 0;
  if (Array.isArray(data.students)) return data.students.length === 0;
  if (Array.isArray(data.staff)) return data.staff.length === 0;
  if (Array.isArray(data.announcements)) return data.announcements.length === 0;
  if (Array.isArray(data.entries)) return data.entries.length === 0;
  if (Array.isArray(data.leaves)) return data.leaves.length === 0;
  if (Array.isArray(data.tickets)) return data.tickets.length === 0;
  if (data.examGroups || data.examRows) return false;
  if (typeof data.campuses === 'number' || typeof data.students === 'number') return false;
  if (Object.keys(data).length === 0) return true;
  return false;
}

function hydrateFromRemote(endpoint, data) {
  if (!data) return;

  const cacheKey = `GET:${endpoint}`;
  setCache(cacheKey, data, null);

  if (Array.isArray(data.campuses)) {
    for (const row of data.campuses) upsertCampus(row);
  }
  if (Array.isArray(data.students)) {
    for (const row of data.students) upsertStudent(row);
  }
  if (Array.isArray(data.staff)) {
    for (const row of data.staff) {
      upsertStaff({
        ...row,
        campusId: row.campusId ?? row.campus_id ?? null,
        roleName: row.roleName ?? row.role ?? null,
        roleId: row.roleId ?? row.customRoleId ?? null,
      });
    }
  }
  if (Array.isArray(data.announcements)) {
    const { upsertAnnouncement } = require('./pull');
    for (const row of data.announcements) upsertAnnouncement(row);
  }

  if (endpoint.startsWith('/institution/settings') && !endpoint.includes('grading')) {
    const { getDb } = require('../db');
    getDb().prepare(
      `INSERT INTO institution_profile(id, payload_json, updated_at, sync_status)
       VALUES (1, ?, datetime('now'), 'synced')
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = datetime('now')`
    ).run(JSON.stringify(data));
  }

  // Cache detailed student profile so image/extra fields work offline.
  const studentDetailMatch = endpoint.match(/^\/institution\/students\/([^/]+)$/);
  if (studentDetailMatch && data?.student) {
    upsertStudent(data.student);
  }
}

module.exports = { isEmptyLocalResponse, hydrateFromRemote };
