const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  data: {
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
