const { randomUUID } = require('crypto');
const { getDb, getMeta, setMeta } = require('../db');
const { ENTITY_FINGERPRINTS, SCHEMA_VERSION } = require('../db/schema');
const { remoteRequest } = require('./remote');
const { logSync } = require('./logger');
const { getDeviceId } = require('./device');
const { markConflict } = require('./conflicts');

function validatePushPayload(entityType, payload) {
  const fingerprint = ENTITY_FINGERPRINTS[entityType];
  if (!fingerprint) return true;
  const required = fingerprint.split(',').filter((field) => field !== 'id');
  const missing = required.filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length > 0) {
    throw new Error(`Push blocked: ${entityType} payload missing fields: ${missing.join(', ')}`);
  }
  return true;
}

function enqueueWrite({ entityType, operation, endpoint, method, payload, serverId }) {
  const db = getDb();
  const localUuid = payload.clientUuid || payload.localUuid || randomUUID();
  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO sync_queue(
      local_uuid, entity_type, operation, endpoint, method, payload_json, server_id,
      sync_status, created_offline_at, source_device_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(local_uuid) DO UPDATE SET
      payload_json = excluded.payload_json,
      endpoint = excluded.endpoint,
      method = excluded.method,
      operation = excluded.operation,
      server_id = COALESCE(excluded.server_id, sync_queue.server_id),
      sync_status = 'pending',
      updated_at = excluded.updated_at`
  ).run(
    localUuid,
    entityType,
    operation,
    endpoint,
    method,
    JSON.stringify({ ...payload, clientUuid: localUuid }),
    serverId || null,
    now,
    deviceId,
    now
  );

  return localUuid;
}

function applyLocalWrite(entityType, operation, payload, serverId) {
  const db = getDb();
  const deviceId = getDeviceId();
  const now = new Date().toISOString();
  const localUuid = payload.clientUuid || randomUUID();

  if (entityType === 'students' && operation === 'create') {
    db.prepare(
      `INSERT INTO students(
        local_uuid, server_id, name, gender, phone, age, year_of_joining, class_roll_number,
        campus_id, class_id, section_id, payload_json, is_deleted, sync_status,
        created_offline_at, source_device_id, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`
    ).run(
      localUuid,
      `${payload.firstName || ''} ${payload.lastName || ''}`.trim(),
      payload.gender || null,
      payload.phone || null,
      payload.age || null,
      payload.yearOfJoining || null,
      payload.classRollNumber || null,
      payload.campusId || null,
      payload.classId || null,
      payload.sectionId || null,
      JSON.stringify(payload),
      now,
      deviceId,
      now
    );
    return { localUuid, optimistic: { id: localUuid, name: `${payload.firstName} ${payload.lastName}`.trim(), status: 'Enrolled' } };
  }

  if (entityType === 'announcements' && operation === 'create') {
    db.prepare(
      `INSERT INTO announcements(
        local_uuid, server_id, title, content, target_type, target_class_id, target_campus_id,
        payload_json, is_deleted, sync_status, created_offline_at, source_device_id, updated_at, created_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)`
    ).run(
      localUuid,
      payload.title,
      payload.content,
      payload.targetType || null,
      payload.targetClassId || null,
      payload.targetCampusId || null,
      JSON.stringify(payload),
      now,
      deviceId,
      now,
      now
    );
    return { localUuid, optimistic: { id: localUuid, ...payload, createdAt: now } };
  }

  if (operation === 'delete' && serverId) {
    const tableMap = {
      students: 'students',
      staff: 'staff',
      campuses: 'campuses',
      announcements: 'announcements',
    };
    const table = tableMap[entityType];
    if (table) {
      db.prepare(
        `UPDATE ${table} SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE server_id = ? OR local_uuid = ?`
      ).run(now, serverId, localUuid);
    }
  }

  return { localUuid };
}

async function pushPendingBatch(token) {
  if (getMeta('push_blocked_reason')) {
    logSync('push', 'blocked', getMeta('push_blocked_reason'), { schemaVersion: SCHEMA_VERSION });
    return { pushed: 0, blocked: true, reason: getMeta('push_blocked_reason') };
  }

  const db = getDb();
  const pending = db.prepare(
    `SELECT * FROM sync_queue WHERE sync_status = 'pending' ORDER BY id ASC LIMIT 50`
  ).all();

  if (pending.length === 0) {
    return { pushed: 0 };
  }

  logSync('push', 'started', `Pushing ${pending.length} pending records`);
  let pushed = 0;
  const errors = [];

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload_json);
      validatePushPayload(item.entity_type, payload);

      const response = await remoteRequest(item.method, item.endpoint, payload, token);

      const serverId =
        response?.id ||
        response?.student?.id ||
        response?.announcement?.id ||
        item.server_id;

      db.prepare(
        `UPDATE sync_queue SET sync_status = 'synced', server_id = ?, updated_at = datetime('now'), last_error = NULL WHERE id = ?`
      ).run(serverId || null, item.id);

      if (serverId && item.entity_type === 'students') {
        db.prepare(`UPDATE students SET server_id = ?, sync_status = 'synced' WHERE local_uuid = ?`).run(serverId, item.local_uuid);
      }
      if (serverId && item.entity_type === 'announcements') {
        db.prepare(`UPDATE announcements SET server_id = ?, sync_status = 'synced' WHERE local_uuid = ?`).run(serverId, item.local_uuid);
      }

      pushed += 1;
    } catch (error) {
      if (error.status === 409) {
        markConflict(item.local_uuid, 'Server conflict (409)');
      }
      const nextRetryCount = Number(item.retry_count || 0) + 1;
      const nextStatus = nextRetryCount >= 5 ? 'failed' : 'pending';
      db.prepare(
        `UPDATE sync_queue
         SET retry_count = ?, sync_status = ?, last_error = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(nextRetryCount, nextStatus, error.message, item.id);
      errors.push({ local_uuid: item.local_uuid, error: error.message });
      logSync('push', 'failed', error.message, { local_uuid: item.local_uuid, endpoint: item.endpoint });
    }
  }

  setMeta('last_push_at', new Date().toISOString());
  logSync('push', errors.length ? 'partial' : 'success', `Pushed ${pushed}/${pending.length}`, { errors });
  return { pushed, errors };
}

module.exports = {
  enqueueWrite,
  applyLocalWrite,
  pushPendingBatch,
  validatePushPayload,
};
