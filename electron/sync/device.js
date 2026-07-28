const { randomUUID } = require('crypto');
const { getMeta, setMeta } = require('../db');

function getDeviceId() {
  let deviceId = getMeta('device_id');
  if (!deviceId) {
    deviceId = randomUUID();
    setMeta('device_id', deviceId);
  }
  return deviceId;
}

module.exports = { getDeviceId };
