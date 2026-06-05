import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, type NativeImage, nativeImage, Tray } from 'electron';
import { appInfo } from '../shared/app-info';
import { type CaptureMode, type CapturePlaceholderResponse, ipcChannels } from '../shared/ipc';

let preferencesWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createSecureWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: appInfo.name,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function showPreferencesWindow(): void {
  if (preferencesWindow) {
    if (preferencesWindow.isMinimized()) {
      preferencesWindow.restore();
    }

    preferencesWindow.show();
    preferencesWindow.focus();
    return;
  }

  preferencesWindow = createSecureWindow();

  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow?.show();
  });

  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
}

function createTrayIcon(): NativeImage {
  const iconSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="3" y="4" width="12" height="10" rx="2" fill="black" />
      <circle cx="9" cy="9" r="2.5" fill="white" />
    </svg>
  `);
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${iconSvg}`);

  image.setTemplateImage(true);

  return image;
}

function handleCapturePlaceholder(mode: CaptureMode): CapturePlaceholderResponse {
  return {
    mode,
    status: 'not-implemented',
  };
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setTitle(appInfo.name);
  tray.setToolTip(appInfo.name);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Capture Region',
        click: () => handleCapturePlaceholder('region'),
      },
      {
        label: 'Capture Window',
        click: () => handleCapturePlaceholder('window'),
      },
      {
        label: 'Capture Full Screen',
        click: () => handleCapturePlaceholder('full-screen'),
      },
      { type: 'separator' },
      {
        label: 'Preferences',
        click: showPreferencesWindow,
      },
      { type: 'separator' },
      {
        label: 'Quit',
        role: 'quit',
      },
    ]),
  );
}

function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.appInfo, () => ({ name: appInfo.name }));
  ipcMain.handle(ipcChannels.captureRegion, () => handleCapturePlaceholder('region'));
  ipcMain.handle(ipcChannels.captureWindow, () => handleCapturePlaceholder('window'));
  ipcMain.handle(ipcChannels.captureFullScreen, () => handleCapturePlaceholder('full-screen'));
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (preferencesWindow) {
      showPreferencesWindow();
    }
  });

  app.whenReady().then(() => {
    app.dock?.hide();
    registerIpcHandlers();
    createTray();

    app.on('activate', () => {
      showPreferencesWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // Snappd is a menu bar utility, so closing auxiliary windows should not quit the app.
});
