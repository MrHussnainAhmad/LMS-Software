const { app } = require('electron');
const packageMetadata = require('../package.json');

const PRODUCTION_ORIGIN = 'https://nisaab360.app';
const LOCAL_ORIGIN = 'http://127.0.0.1:3000';

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

const configuredOrigin =
  process.env.NISAAB360_API_ORIGIN ||
  packageMetadata.nisaab360ApiOrigin ||
  (app.isPackaged ? PRODUCTION_ORIGIN : LOCAL_ORIGIN);

const API_ORIGIN = normalizeOrigin(configuredOrigin) || PRODUCTION_ORIGIN;
const API_BASE_URL = `${API_ORIGIN}/api`;

module.exports = { API_ORIGIN, API_BASE_URL };
