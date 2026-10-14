// Shared by renderer, IPC, health probes, and offline sync.
// Development and packaged builds both connect to the deployed LMS service.
const API_ORIGIN = 'https://nisaab360.app';
const API_BASE_URL = API_ORIGIN + '/api';
module.exports = { API_ORIGIN, API_BASE_URL };
