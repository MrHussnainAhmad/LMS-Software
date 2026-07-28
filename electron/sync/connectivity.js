const { net } = require('electron');
const dns = require('node:dns/promises');
const { setOnlineStatus, schedulePushSoon } = require('./engine');
const { logSync } = require('./logger');

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
  if (!net.isOnline()) return false;
  try {
    await Promise.race([
      dns.lookup('nisaab360.app'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), 1500)),
    ]);
    return true;
  } catch {
    return false;
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
