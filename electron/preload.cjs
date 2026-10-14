const { contextBridge, ipcRenderer } = require('electron');

const apiOriginArgument = process.argv.find((argument) => argument.startsWith('--nisaab360-api-origin='));
const apiOrigin = apiOriginArgument?.slice('--nisaab360-api-origin='.length) || 'https://nisaab360.app';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  config: {
    apiOrigin,
    apiBaseUrl: `${apiOrigin}/api`,
  },
  data: {
    live(request) {
      return ipcRenderer.invoke('api:live', request);
    },
    request(method, endpoint, data, authToken) {
      return ipcRenderer.invoke('data:request', { method, endpoint, data, authToken });
    },
  },
  sync: {
    initial(token) {
      return ipcRenderer.invoke('sync:initial', token);
    },
    pull(token) {
      return ipcRenderer.invoke('sync:pull', token);
    },
    students(token) {
      return ipcRenderer.invoke('sync:students', token);
    },
    push() {
      return ipcRenderer.invoke('sync:push');
    },
    status() {
      return ipcRenderer.invoke('sync:status');
    },
    logs(limit) {
      return ipcRenderer.invoke('sync:logs', limit);
    },
  },
  auth: {
    googleDrive(url) { return ipcRenderer.invoke('auth:google-drive', url); },
    setToken(token) {
      return ipcRenderer.invoke('auth:set-token', token);
    },
    clearToken() {
      return ipcRenderer.invoke('auth:clear-token');
    },
  },
  app: {
    startupState() {
      return ipcRenderer.invoke('app:startup-state');
    },
    checkUpdate() {
      return ipcRenderer.invoke('app:check-update');
    },
    openUpdate() {
      return ipcRenderer.invoke('app:open-update');
    },
  },
});
