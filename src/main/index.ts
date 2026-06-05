import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  type NativeImage,
  Notification,
  nativeImage,
  Tray,
} from 'electron';
import { appInfo } from '../shared/app-info';
import {
  type CaptureMode,
  type CapturePlaceholderResponse,
  ipcChannels,
  type ShortcutStatus,
} from '../shared/ipc';
import { type AppSettings, normalizeSettings } from '../shared/settings';
import { getCaptureFoundationState, openScreenRecordingSettings } from './capture-foundation';
import { getSettingsFilePath, readSettings, writeSettings } from './settings-store';

let preferencesWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: AppSettings;
let shortcutStatus: ShortcutStatus = { region: 'not-registered' };

function createSecureWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: appInfo.name,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load: ${errorCode} ${errorDescription}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Renderer process gone: ${details.reason}`);
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
  console.info(`Capture ${mode} requested.`);

  return {
    mode,
    status: 'not-implemented',
  };
}

function applyDockVisibility(): void {
  if (settings.showDockIcon) {
    app.dock?.show();
    return;
  }

  app.dock?.hide();
}

function registerShortcuts(): void {
  globalShortcut.unregisterAll();
  const registered = globalShortcut.register(settings.regionShortcut, () => {
    handleCapturePlaceholder('region');
  });

  shortcutStatus = {
    region: registered ? 'registered' : 'conflict',
  };

  if (!registered) {
    new Notification({
      title: appInfo.name,
      body: `Could not register shortcut ${settings.regionShortcut}. Change it in Preferences.`,
    }).show();
  }
}

function buildTrayMenu(): Menu {
  const shortcutConflictItem =
    shortcutStatus.region === 'conflict'
      ? [
          {
            label: `Shortcut conflict: ${settings.regionShortcut}`,
            enabled: false,
          },
          { type: 'separator' as const },
        ]
      : [];

  return Menu.buildFromTemplate([
    ...shortcutConflictItem,
    {
      label: 'Capture Region',
      accelerator: settings.regionShortcut,
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
  ]);
}

function refreshTrayMenu(): void {
  tray?.setContextMenu(buildTrayMenu());
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setTitle(appInfo.name);
  tray.setToolTip(appInfo.name);
  refreshTrayMenu();
}

async function updateSettings(nextSettings: unknown): Promise<void> {
  settings = await writeSettings(normalizeSettings(nextSettings));
  applyDockVisibility();
  registerShortcuts();
  refreshTrayMenu();
}

function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.appInfo, () => ({ name: appInfo.name }));
  ipcMain.handle(ipcChannels.settingsGet, () => ({
    settings,
    shortcutStatus,
    settingsPath: getSettingsFilePath(),
  }));
  ipcMain.handle(ipcChannels.settingsUpdate, async (_event, nextSettings: unknown) => {
    await updateSettings(nextSettings);

    return {
      settings,
      shortcutStatus,
      settingsPath: getSettingsFilePath(),
    };
  });
  ipcMain.handle(ipcChannels.captureFoundationGet, async () => ({
    foundation: await getCaptureFoundationState(),
  }));
  ipcMain.handle(ipcChannels.capturePermissionOpenSettings, async () => {
    await openScreenRecordingSettings();
  });
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

  app.whenReady().then(async () => {
    settings = await readSettings();
    applyDockVisibility();
    registerIpcHandlers();
    registerShortcuts();
    createTray();

    app.on('activate', () => {
      showPreferencesWindow();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Snappd is a menu bar utility, so closing auxiliary windows should not quit the app.
});
