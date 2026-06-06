import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  type Display,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  type NativeImage,
  Notification,
  nativeImage,
  screen,
  Tray,
} from 'electron';
import { appInfo } from '../shared/app-info';
import type { CaptureResult, Rectangle } from '../shared/capture';
import { clampRectToBounds, toPhysicalRect } from '../shared/geometry';
import {
  type CaptureActionResponse,
  type CaptureMode,
  type CapturePlaceholderResponse,
  ipcChannels,
  type RegionSelectionPayload,
  type ShortcutStatus,
} from '../shared/ipc';
import { type AppSettings, normalizeSettings } from '../shared/settings';
import { getCaptureFoundationState, openScreenRecordingSettings } from './capture-foundation';
import { getSettingsFilePath, readSettings, writeSettings } from './settings-store';

let preferencesWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: AppSettings;
let shortcutStatus: ShortcutStatus = { region: 'not-registered' };
let overlayWindows: BrowserWindow[] = [];
let activeRegionCapture: ((response: CaptureActionResponse) => void) | null = null;

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

async function startRegionCapture(): Promise<CaptureActionResponse> {
  if (activeRegionCapture) {
    return {
      mode: 'region',
      status: 'failed',
      message: 'Region capture is already active.',
    };
  }

  const permissionResponse = await verifyScreenCaptureAccess();

  if (permissionResponse) {
    showPreferencesWindow();
    return permissionResponse;
  }

  const displays = screen.getAllDisplays();

  if (displays.length === 0) {
    return {
      mode: 'region',
      status: 'failed',
      message: 'No displays were found.',
    };
  }

  return new Promise((resolve) => {
    activeRegionCapture = resolve;
    overlayWindows = displays.map(createRegionOverlayWindow);
    globalShortcut.register('Escape', cancelRegionCapture);
  });
}

async function verifyScreenCaptureAccess(): Promise<CaptureActionResponse | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
      fetchWindowIcons: false,
    });

    if (sources.length > 0) {
      return null;
    }
  } catch (error) {
    return {
      mode: 'region',
      status: 'permission-required',
      message: error instanceof Error ? error.message : 'Snappd could not access screen sources.',
    };
  }

  return {
    mode: 'region',
    status: 'permission-required',
    message: 'Snappd could not access screen sources. Check Screen Recording permission.',
  };
}

function createRegionOverlayWindow(display: Display): BrowserWindow {
  const overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      cancelRegionCapture();
    }
  });

  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
    overlayWindow.focus();
  });

  overlayWindow.on('closed', () => {
    overlayWindows = overlayWindows.filter((window) => window !== overlayWindow);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void overlayWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/overlay.html?displayId=${display.id}`,
    );
  } else {
    void overlayWindow.loadFile(join(__dirname, '../renderer/overlay.html'), {
      query: { displayId: String(display.id) },
    });
  }

  return overlayWindow;
}

async function completeRegionCapture(payload: RegionSelectionPayload): Promise<void> {
  const resolve = activeRegionCapture;

  if (!resolve) {
    return;
  }

  activeRegionCapture = null;
  closeOverlayWindows();

  resolve(await captureSelectedRegion(payload));
}

function cancelRegionCapture(): void {
  const resolve = activeRegionCapture;

  activeRegionCapture = null;
  closeOverlayWindows();
  resolve?.({ mode: 'region', status: 'cancelled' });
}

function closeOverlayWindows(): void {
  globalShortcut.unregister('Escape');

  for (const overlayWindow of overlayWindows) {
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
  }

  overlayWindows = [];
}

async function captureSelectedRegion(
  payload: RegionSelectionPayload,
): Promise<CaptureActionResponse> {
  const display = screen.getAllDisplays().find((candidate) => candidate.id === payload.displayId);

  if (!display) {
    return {
      mode: 'region',
      status: 'failed',
      message: 'Selected display was not found.',
    };
  }

  const selectedRect = clampRectToBounds(toGlobalRect(payload.rect, display), display.bounds);

  if (selectedRect.width <= 0 || selectedRect.height <= 0) {
    return { mode: 'region', status: 'cancelled' };
  }

  const physicalDisplaySize = {
    width: Math.round(display.bounds.width * display.scaleFactor),
    height: Math.round(display.bounds.height * display.scaleFactor),
  };
  let sources: Electron.DesktopCapturerSource[];

  try {
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: physicalDisplaySize,
      fetchWindowIcons: false,
    });
  } catch (error) {
    showPreferencesWindow();

    return {
      mode: 'region',
      status: 'permission-required',
      message: error instanceof Error ? error.message : 'Snappd could not access screen sources.',
    };
  }

  const source = sources.find((candidate) => candidate.display_id === String(display.id));

  if (!source) {
    showPreferencesWindow();

    return {
      mode: 'region',
      status: 'permission-required',
      message: 'Snappd could not access this display. Check Screen Recording permission.',
    };
  }

  const physicalRect = toPhysicalRect(selectedRect, display);
  const croppedImage = source.thumbnail.crop(physicalRect);

  if (croppedImage.isEmpty()) {
    showPreferencesWindow();

    return {
      mode: 'region',
      status: 'permission-required',
      message: 'Snappd captured an empty image. Check Screen Recording permission.',
    };
  }

  if (settings.automaticClipboardCopy) {
    clipboard.writeImage(croppedImage);
  }

  const result: CaptureResult = {
    image: { dataUrl: croppedImage.toDataURL() },
    width: physicalRect.width,
    height: physicalRect.height,
    sourceKind: 'screen',
    timestamp: new Date().toISOString(),
  };

  return {
    mode: 'region',
    status: 'copied-to-clipboard',
    result,
  };
}

function toGlobalRect(rect: Rectangle, display: Display): Rectangle {
  return {
    x: rect.x + display.bounds.x,
    y: rect.y + display.bounds.y,
    width: rect.width,
    height: rect.height,
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
    void startRegionCapture();
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
      click: () => void startRegionCapture(),
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
  ipcMain.handle(ipcChannels.captureRegion, () => startRegionCapture());
  ipcMain.handle(ipcChannels.captureWindow, () => handleCapturePlaceholder('window'));
  ipcMain.handle(ipcChannels.captureFullScreen, () => handleCapturePlaceholder('full-screen'));
  ipcMain.handle(
    ipcChannels.regionSelectionComplete,
    async (_event, payload: RegionSelectionPayload) => {
      await completeRegionCapture(payload);
    },
  );
  ipcMain.handle(ipcChannels.regionSelectionCancel, () => {
    cancelRegionCapture();
  });
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
