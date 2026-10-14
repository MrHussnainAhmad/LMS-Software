const { ipcMain, app, shell } = require('electron');
const { initDatabase, getMeta, setMeta } = require('../db');
const { handleDataRequest, setCache } = require('../data/router');
const { runInitialSync, runPushCycle, getSyncStatus } = require('../sync/engine');
const { getRecentLogs } = require('../sync/logger');
const { remoteRequest } = require('../sync/remote');
const { pullAll, pullStudents } = require('../sync/pull');
const { checkConnectivity } = require('../sync/connectivity');
const { API_ORIGIN, API_BASE_URL } = require('../config');

const VERSION_URL = `${API_BASE_URL}/public/software-version`;
const DOWNLOAD_URL = `${API_ORIGIN}/download-software`;

function isVersionNewer(candidate, current) {
  const candidateParts = String(candidate || '').replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const currentParts = String(current || '').replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(candidateParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const candidatePart = candidateParts[index] || 0;
    const currentPart = currentParts[index] || 0;
    if (candidatePart > currentPart) return true;
    if (candidatePart < currentPart) return false;
  }
  return false;
}

function registerIpcHandlers() {
  initDatabase();

  ipcMain.handle('api:live', async (event, request) => {
    const source = event.senderFrame?.url || '';
    if (!(source.startsWith('file:') || source.startsWith('http://localhost:5173/'))) throw new Error('Untrusted renderer');
    return require('./live').liveRequest(request);
  });
  ipcMain.handle('auth:google-drive', async (event, url) => {
    const source = event.senderFrame?.url || '';
    if (!(source.startsWith('file:') || source.startsWith('http://localhost:5173/'))) throw new Error('Untrusted renderer');
    return require('./google-drive').authorizeGoogleDrive(require('electron').BrowserWindow.fromWebContents(event.sender), url);
  });

  ipcMain.handle('sync:initial', async (_event, token) => {
    return runInitialSync(token);
  });

  ipcMain.handle('sync:pull', async (_event, token) => {
    const authToken = token || getMeta('auth_token');
    return pullAll(authToken);
  });

  ipcMain.handle('sync:students', async (_event, token) => {
    const authToken = token || getMeta('auth_token');
    return pullStudents(authToken);
  });

  ipcMain.handle('sync:push', async () => {
    await runPushCycle();
    return getSyncStatus();
  });

  ipcMain.handle('sync:status', async () => getSyncStatus());

  ipcMain.handle('sync:logs', async (_event, limit) => getRecentLogs(limit || 100));

  ipcMain.handle('data:request', async (_event, { method, endpoint, data, authToken }) => {
    if (authToken) setMeta('auth_token', authToken);

    if (endpoint === '/auth/login') {
      return remoteRequest('POST', endpoint, data);
    }

    if (endpoint === '/institution/export') {
      return remoteRequest('GET', endpoint, undefined, authToken || getMeta('auth_token'));
    }

    const upper = method.toUpperCase();
    const token = authToken || getMeta('auth_token');
    const online = checkConnectivity();

    // Local-first policy: GET reads should be instant from local DB/cache.
    // Explicit network-backed routes can still bypass this branch (e.g. export).
    if (upper === 'GET') {
      if (endpoint.startsWith('/institution/staff-attendance?') && online && token) {
        const cached = handleDataRequest('GET', endpoint, data);
        if (cached.pendingSync) return cached;
        try {
          const current = await remoteRequest('GET', endpoint, undefined, token);
          setCache(`GET:${endpoint}`, current);
          // A local write may have arrived while the request was in flight.
          return handleDataRequest('GET', endpoint, data);
        } catch (error) {
          if (error.status === 401 || error.status === 403) throw error;
          return cached;
        }
      }
      return handleDataRequest('GET', endpoint, data);
    }

    // For writes we still queue locally and push in background. Connectivity is used by sync engine.
    if (!token && online) {
      throw new Error('Unauthorized');
    }
    return handleDataRequest(upper, endpoint, data);
  });

  ipcMain.handle('auth:set-token', async (_event, token) => {
    setMeta('auth_token', token || '');
    return { success: true };
  });

  ipcMain.handle('auth:clear-token', async () => {
    setMeta('auth_token', '');
    return { success: true };
  });

  ipcMain.handle('app:startup-state', async () => {
    const shouldResetSession = getMeta('session_reset_required') === '1';
    if (shouldResetSession) {
      setMeta('session_reset_required', '0');
      setMeta('auth_token', '');
    }
    return { shouldResetSession };
  });

  ipcMain.handle('app:check-update', async () => {
    const currentVersion = app.getVersion();
    try {
      const response = await fetch(VERSION_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Version check failed (${response.status})`);
      const payload = await response.json();
      const latestVersion = String(payload?.version || '').trim();
      return {
        currentVersion,
        latestVersion,
        updateAvailable: Boolean(latestVersion) && isVersionNewer(latestVersion, currentVersion),
      };
    } catch {
      // Version checks must never interrupt startup or offline use.
      return { currentVersion, latestVersion: null, updateAvailable: false };
    }
  });

  ipcMain.handle('app:open-update', async () => {
    await shell.openExternal(DOWNLOAD_URL);
    return { success: true };
  });
}

module.exports = { registerIpcHandlers };
