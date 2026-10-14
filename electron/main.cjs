const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc/handlers');
const { startConnectivityMonitor, stopConnectivityMonitor } = require('./sync/connectivity');
const { scheduleMidnightPull } = require('./sync/scheduler');
const { initDatabase } = require('./db');
const { API_ORIGIN } = require('./config');

const isDev = !app.isPackaged;

// Aggressively limit Chromium's JavaScript heap to 256MB to force earlier garbage collection 
// and keep active RAM usage significantly lower.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Keep Windows shell previews and Electron-owned mini windows aligned with the product title.
app.setName('Nisaab360 - Institution Portal');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
    icon: path.join(__dirname, '../icon.png'),
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:')) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { preload: undefined, nodeIntegration: false, contextIsolation: true, sandbox: true } } };
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const trusted = isDev ? url.startsWith('http://localhost:5173/') : url.startsWith('file:') && url.split('#')[0] === mainWindow.webContents.getURL().split('#')[0];
    if (!trusted) { event.preventDefault(); if (/^https?:/.test(url)) void shell.openExternal(url); }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Nisaab360',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Nisaab360 (Syncing in background)');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  startConnectivityMonitor();
  scheduleMidnightPull();
  createWindow();
  createTray();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', function () {
  if (app.isQuitting) {
    stopConnectivityMonitor();
    if (process.platform !== 'darwin') app.quit();
  }
});
