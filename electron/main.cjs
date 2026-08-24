const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc/handlers');
const { startConnectivityMonitor, stopConnectivityMonitor } = require('./sync/connectivity');
const { scheduleMidnightPull } = require('./sync/scheduler');
const { initDatabase } = require('./db');
const { API_ORIGIN } = require('./config');

const isDev = !app.isPackaged;

// Keep Windows shell previews and Electron-owned mini windows aligned with the product title.
app.setName('Nisaab360 - Institution Portal');

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'Nisaab360 - Institution Portal',
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--nisaab360-api-origin=${API_ORIGIN}`],
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  startConnectivityMonitor();
  scheduleMidnightPull();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopConnectivityMonitor();
  if (process.platform !== 'darwin') app.quit();
});
