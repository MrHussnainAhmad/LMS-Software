const { randomUUID } = require('crypto');
const { getDb } = require('../db');
const { setCache } = require('../sync/pull');
const { enqueueWrite, applyLocalWrite } = require('../sync/push');
const { getDeviceId } = require('../sync/device');
const { schedulePushSoon } = require('../sync/engine');

function getCache(key) {
  const row = getDb().prepare('SELECT response_json FROM api_cache WHERE cache_key = ?').get(key);
  return row ? JSON.parse(row.response_json) : null;
}

function parseQuery(endpoint) {
  const [path, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);
  return { path, params };
}

function studentsToPickerRows(rows) {
  return rows.map((row) => ({
    id: row.server_id || row.local_uuid,
    name: row.name,
    classRollNumber: row.class_roll_number,
    loginRollNumber: row.login_roll_number,
    className: row.class_name,
    sectionName: row.section_name,
    campusId: row.campus_id,
    status: row.status || 'Enrolled',
  }));
}

function staffToRows(rows) {
  return rows.map((row) => ({
    id: row.server_id || row.local_uuid,
    name: row.name,
    email: row.email,
    phone: row.phone,
    campusId: row.campus_id,
    roleId: row.role_id,
    roleName: row.role_name,
    ...(row.payload_json ? JSON.parse(row.payload_json) : {}),
  }));
}

function campusesToRows(rows) {
  return rows.map((row) => ({
    id: row.server_id || row.local_uuid,
    name: row.name,
    address: row.address,
    ...(row.payload_json ? JSON.parse(row.payload_json) : {}),
  }));
}

function announcementsToRows(rows) {
  return rows.map((row) => ({
    id: row.server_id || row.local_uuid,
    title: row.title,
    content: row.content,
    targetType: row.target_type,
    targetClassId: row.target_class_id,
    targetCampusId: row.target_campus_id,
    createdAt: row.created_at,
    ...(row.payload_json ? JSON.parse(row.payload_json) : {}),
  }));
}

function normalizeId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function handleGet(endpoint) {
  const { path, params } = parseQuery(endpoint);
  const campusId = params.get('campusId');
  const db = getDb();

  if (path === '/institution/campuses') {
    const rows = db.prepare('SELECT * FROM campuses WHERE is_deleted = 0 ORDER BY name').all();
    return { campuses: campusesToRows(rows) };
  }

  if (path === '/institution/students/picker') {
    let query = 'SELECT * FROM students WHERE is_deleted = 0';
    const args = [];
    if (campusId) {
      query += ' AND campus_id = ?';
      args.push(Number(campusId));
    }
    const q = (params.get('q') || '').trim().toLowerCase();
    query += ' ORDER BY name';
    let rows = db.prepare(query).all(...args);
    if (q) {
      rows = rows.filter((row) =>
        (row.name || '').toLowerCase().includes(q) ||
        (row.login_roll_number || '').toLowerCase().includes(q) ||
        (row.class_roll_number || '').toLowerCase().includes(q)
      );
    }
    const limit = Number(params.get('limit') || 30);
    return { students: studentsToPickerRows(rows.slice(0, limit)) };
  }

  if (path === '/institution/students/id-cards') {
    const studentIdsParam = (params.get('studentIds') || '').trim();
    const q = normalizeId(params.get('q'));

    let rows = [];
    if (studentIdsParam) {
      const parsedIds = studentIdsParam
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isInteger(v));
      if (parsedIds.length > 0) {
        const placeholders = parsedIds.map(() => '?').join(',');
        rows = db
          .prepare(`SELECT * FROM students WHERE is_deleted = 0 AND server_id IN (${placeholders}) ORDER BY name`)
          .all(...parsedIds);
      }
    }

    if (rows.length === 0) {
      rows = db.prepare('SELECT * FROM students WHERE is_deleted = 0 ORDER BY name').all();
    }

    if (q) {
      rows = rows.filter((row) => {
        const uid = normalizeId((row.login_roll_number || '').split('@')[0]);
        const fullUid = normalizeId(row.login_roll_number || '');
        const roll = normalizeId(row.class_roll_number || '');
        const name = normalizeId(row.name || '');
        return uid.includes(q) || fullUid.includes(q) || roll.includes(q) || name.includes(q);
      });
    }

    const settingsRow = db.prepare('SELECT payload_json FROM institution_profile WHERE id = 1').get();
    const institution = settingsRow ? JSON.parse(settingsRow.payload_json || '{}') : {};

    return {
      institution,
      students: rows.map((row) => {
        const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
        return {
          id: row.server_id || row.local_uuid,
          name: row.name,
          classRollNumber: row.class_roll_number || payload.classRollNumber || '',
          className: row.class_name || payload.className || '',
          sectionName: row.section_name || payload.sectionName || '',
          fatherName: row.father_name || payload.fatherName || null,
          phone: row.phone || payload.phone || null,
          emergencyContact: row.emergency_contact || payload.emergencyContact || null,
          profilePictureUrl:
            row.profile_picture_url ||
            payload.profilePictureUrl ||
            payload.profilePicture ||
            payload.imageUrl ||
            null,
          loginRollNumber: row.login_roll_number || payload.loginRollNumber || '',
        };
      }),
    };
  }

  if (path === '/institution/staff') {
    let query = 'SELECT * FROM staff WHERE is_deleted = 0';
    const args = [];
    if (campusId) {
      query += ' AND campus_id = ?';
      args.push(Number(campusId));
    }
    query += ' ORDER BY name';
    let rows = db.prepare(query).all(...args);
    const q = (params.get('q') || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        (row.name || '').toLowerCase().includes(q) ||
        (row.email || '').toLowerCase().includes(q)
      );
    }
    return { staff: staffToRows(rows) };
  }

  if (path === '/institution/announcements') {
    const rows = db.prepare('SELECT * FROM announcements WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    return { announcements: announcementsToRows(rows) };
  }

  if (path === '/institution/dashboard') {
    const cacheKey = campusId ? `GET:/institution/dashboard:?campusId=${campusId}` : 'GET:/institution/dashboard';
    const cached = getCache(cacheKey) || getCache('GET:/institution/dashboard') || {};
    if (campusId) {
      const campusStudents = db.prepare('SELECT COUNT(*) AS count FROM students WHERE is_deleted = 0 AND campus_id = ?').get(Number(campusId));
      const campusStaff = db.prepare('SELECT COUNT(*) AS count FROM staff WHERE is_deleted = 0 AND campus_id = ?').get(Number(campusId));
      return {
        ...cached,
        students: campusStudents?.count || 0,
        staff: campusStaff?.count || 0,
      };
    }
    const students = db.prepare('SELECT COUNT(*) AS count FROM students WHERE is_deleted = 0').get();
    const staffCount = db.prepare('SELECT COUNT(*) AS count FROM staff WHERE is_deleted = 0').get();
    const campuses = db.prepare('SELECT COUNT(*) AS count FROM campuses WHERE is_deleted = 0').get();
    return {
      ...cached,
      students: students?.count || cached.students || 0,
      staff: staffCount?.count || cached.staff || 0,
      campuses: campuses?.count || cached.campuses || 0,
    };
  }

  if (path === '/institution/dashboard/charts') {
    const cacheKey = campusId ? `GET:/institution/dashboard/charts:?campusId=${campusId}` : 'GET:/institution/dashboard/charts';
    return getCache(cacheKey) || getCache('GET:/institution/dashboard/charts') || {
      attendanceTrends: [],
      classDistribution: [],
      examPerformance: [],
    };
  }

  if (path === '/institution/settings') {
    const row = getDb().prepare('SELECT payload_json FROM institution_profile WHERE id = 1').get();
    return row ? JSON.parse(row.payload_json) : getCache('GET:/institution/settings') || {};
  }

  if (path === '/institution/batch-exams') {
    return getCache('GET:/institution/batch-exams') || { batchExams: [] };
  }

  if (path === '/institution/timetable' && params.get('metadata') === 'true') {
    return getCache('GET:/institution/timetable?metadata=true') || { allClasses: [], allSections: [] };
  }

  if (path.startsWith('/institution/students/') && path.endsWith('/history')) {
    const cacheKey = `GET:${endpoint}`;
    return getCache(cacheKey) || { attendance: [], marks: [], batchExams: [] };
  }

  if (path === '/institution/roles') return getCache('GET:/institution/roles') || { roles: [] };
  if (path === '/institution/admins') return getCache('GET:/institution/admins') || { admins: [], maxAdmins: 2 };
  if (path === '/institution/exams') return getCache('GET:/institution/exams') || { examRows: [], examGroups: [] };
  if (path === '/institution/settings/grading') return getCache('GET:/institution/settings/grading') || { scales: [] };
  if (path === '/institution/students/auto-promote') return getCache('GET:/institution/students/auto-promote') || { classes: [] };
  if (path === '/institution/staff-attendance') return getCache(`GET:${endpoint}`) || getCache(`GET:/institution/staff-attendance?date=${params.get('date')}`) || { records: [] };
  if (path === '/institution/leaves') return getCache(`GET:${endpoint}`) || { leaves: [] };
  if (path === '/institution/tickets') return getCache(`GET:${endpoint}`) || { tickets: [] };
  if (path === '/institution/timetable') return getCache(`GET:${endpoint}`) || getCache('GET:/institution/timetable?metadata=true') || { entries: [], allClasses: [], allSections: [] };
  if (path === '/institution/diary') {
    const cached = getCache(`GET:${endpoint}`);
    if (Array.isArray(cached)) return cached;
    if (Array.isArray(cached?.entries)) return cached.entries;
    return [];
  }

  const studentMatch = path.match(/^\/institution\/students\/([^/]+)$/);
  if (studentMatch) {
    const rawId = studentMatch[1];
    const numericId = Number(rawId);
    const row = Number.isFinite(numericId)
      ? db.prepare('SELECT * FROM students WHERE (server_id = ? OR local_uuid = ?) AND is_deleted = 0').get(numericId, rawId)
      : db.prepare('SELECT * FROM students WHERE local_uuid = ? AND is_deleted = 0').get(rawId);
    if (!row) throw new Error('Student not found');
    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    return {
      student: {
        id: row.server_id || row.local_uuid,
        name: row.name,
        fatherName: row.father_name,
        gender: row.gender,
        loginRollNumber: row.login_roll_number,
        classRollNumber: row.class_roll_number,
        profilePictureUrl:
          row.profile_picture_url ||
          payload.profilePictureUrl ||
          payload.profilePicture ||
          payload.imageUrl ||
          null,
        emergencyContact: row.emergency_contact,
        parentalWhatsapp: row.parental_whatsapp,
        yearOfJoining: row.year_of_joining,
        phone: row.phone,
        age: row.age,
        campusName: row.campus_name,
        className: row.class_name,
        sectionName: row.section_name,
        ...payload,
      },
    };
  }

  const cacheKey = `GET:${endpoint}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  throw new Error(`Local data unavailable for ${endpoint}. Connect once to sync.`);
}

function handleWrite(method, endpoint, data) {
  const { path, params } = parseQuery(endpoint);
  const deviceId = getDeviceId();
  const serverIdParam = params.get('id');
  const shouldUseStableKey = method !== 'POST' && Boolean(serverIdParam);
  const clientUuid = shouldUseStableKey ? `${method}:${path}:${serverIdParam}` : randomUUID();
  const payload = { ...(data || {}), clientUuid, sourceDeviceId: deviceId, updatedAt: new Date().toISOString() };

  if (method === 'POST' && path === '/institution/students') {
    applyLocalWrite('students', 'create', payload);
    enqueueWrite({
      entityType: 'students',
      operation: 'create',
      endpoint: '/institution/students',
      method: 'POST',
      payload,
    });
    schedulePushSoon();
    return { success: true, id: clientUuid, clientUuid };
  }

  if (method === 'POST' && path === '/institution/announcements') {
    applyLocalWrite('announcements', 'create', payload);
    enqueueWrite({
      entityType: 'announcements',
      operation: 'create',
      endpoint: '/institution/announcements',
      method: 'POST',
      payload,
    });
    schedulePushSoon();
    return { success: true, id: clientUuid, clientUuid };
  }

  if (method === 'DELETE' && path === '/institution/announcements') {
    const id = params.get('id');
    applyLocalWrite('announcements', 'delete', payload, Number(id));
    enqueueWrite({
      entityType: 'announcements',
      operation: 'delete',
      endpoint: `/institution/announcements?id=${id}`,
      method: 'DELETE',
      payload: { clientUuid, id: Number(id) },
      serverId: Number(id),
    });
    getDb().prepare('UPDATE announcements SET is_deleted = 1, sync_status = \'pending\' WHERE server_id = ? OR local_uuid = ?').run(Number(id), String(id));
    schedulePushSoon();
    return { success: true };
  }

  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    enqueueWrite({
      entityType: 'generic',
      operation: method === 'DELETE' ? 'delete' : method === 'POST' ? 'create' : 'update',
      endpoint: path + (params.toString() ? `?${params.toString()}` : ''),
      method,
      payload,
      serverId: params.get('id') ? Number(params.get('id')) : null,
    });
    setCache(`WRITE:${method}:${endpoint}`, payload);
    schedulePushSoon();
    return { success: true, queued: true, clientUuid };
  }

  throw new Error(`Unsupported local write: ${method} ${endpoint}`);
}

function handleDataRequest(method, endpoint, data) {
  const upper = method.toUpperCase();
  if (upper === 'GET') return handleGet(endpoint);
  return handleWrite(upper, endpoint, data);
}

module.exports = { handleDataRequest, getCache, setCache };
