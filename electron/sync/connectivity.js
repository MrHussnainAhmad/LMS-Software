const { setOnlineStatus, schedulePushSoon } = require('./engine');
const { logSync } = require('./logger');
const { API_BASE_URL } = require('../config');

let lastOnline = null;
let pollId = null;
let probeRunning = false;

function checkConnectivity() {
  if (lastOnline === null) {
    const initial = net.isOnline();
    lastOnline = initial;
    setOnlineStatus(initial);
  }
  return Boolean(lastOnline);
}

async function probeInternet() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkConnectivityProbe() {
  if (probeRunning) return lastOnline ?? false;
  probeRunning = true;
  try {
    const online = await probeInternet();
    if (lastOnline !== online) {
      lastOnline = online;
      setOnlineStatus(online);
      logSync(online ? 'push' : 'pull', online ? 'online' : 'offline', `Connectivity changed: ${online ? 'online' : 'offline'}`);
      if (online) schedulePushSoon();
    }
    return online;
  } finally {
    probeRunning = false;
  }
}

function startConnectivityMonitor() {
  if (pollId) clearInterval(pollId);
  checkConnectivityProbe().catch(() => {});
  pollId = setInterval(() => {
    checkConnectivityProbe().catch(() => {});
  }, 3000);
}

function stopConnectivityMonitor() {
  if (pollId) clearInterval(pollId);
  pollId = null;
}

module.exports = { startConnectivityMonitor, stopConnectivityMonitor, checkConnectivity };
