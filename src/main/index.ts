import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  type Display,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  type NativeImage,
  Notification,
  nativeImage,
  type OpenDialogOptions,
  screen,
  Tray,
} from 'electron';
import { appInfo } from '../shared/app-info';
import type { CaptureResult, Rectangle } from '../shared/capture';
import { displayContainingPoint } from '../shared/displays';
import { expandHomeDirectory, screenshotFilePath } from '../shared/files';
import { clampRectToBounds, toPhysicalRect } from '../shared/geometry';
import {
  type AnnotationImagePayload,
  type CaptureActionResponse,
  type CaptureMode,
  ipcChannels,
  type RegionSelectionPayload,
  type SaveCaptureResponse,
  type ShortcutStatus,
} from '../shared/ipc';
import { type AppSettings, normalizeSettings } from '../shared/settings';
import { isValidShortcut } from '../shared/shortcuts';
import { getCaptureFoundationState, openScreenRecordingSettings } from './capture-foundation';
import { getSettingsFilePath, readSettings, writeSettings } from './settings-store';

let preferencesWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: AppSettings;
let shortcutStatus: ShortcutStatus = { region: 'not-registered' };
let overlayWindows: BrowserWindow[] = [];
let previewWindow: BrowserWindow | null = null;
let sourcePickerWindow: BrowserWindow | null = null;
let annotationWindow: BrowserWindow | null = null;
let latestPreviewCapture: CaptureResult | null = null;
let windowCaptureSources: Electron.DesktopCapturerSource[] = [];
let activeRegionCapture: ((response: CaptureActionResponse) => void) | null = null;
let activeWindowCapture: ((response: CaptureActionResponse) => void) | null = null;

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

function showPreviewWindow(capture: CaptureResult): void {
  latestPreviewCapture = capture;

  if (previewWindow) {
    if (previewWindow.isMinimized()) {
      previewWindow.restore();
    }

    previewWindow.reload();
    previewWindow.show();
    previewWindow.focus();
    return;
  }

  previewWindow = new BrowserWindow({
    width: 760,
    height: 540,
    minWidth: 480,
    minHeight: 320,
    title: `${appInfo.name} Preview`,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  previewWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  previewWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  previewWindow.once('ready-to-show', () => {
    previewWindow?.show();
  });

  previewWindow.on('closed', () => {
    previewWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void previewWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/preview.html`);
  } else {
    void previewWindow.loadFile(join(__dirname, '../renderer/preview.html'));
  }
}

function closePreviewWindow(): void {
  previewWindow?.close();
}

function showSourcePickerWindow(): void {
  if (sourcePickerWindow) {
    if (sourcePickerWindow.isMinimized()) {
      sourcePickerWindow.restore();
    }

    sourcePickerWindow.show();
    sourcePickerWindow.focus();
    return;
  }

  sourcePickerWindow = new BrowserWindow({
    width: 840,
    height: 620,
    minWidth: 520,
    minHeight: 360,
    title: 'Choose Window',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  sourcePickerWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  sourcePickerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  sourcePickerWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      cancelWindowCapture();
    }
  });

  sourcePickerWindow.once('ready-to-show', () => {
    sourcePickerWindow?.show();
  });

  sourcePickerWindow.on('closed', () => {
    sourcePickerWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void sourcePickerWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/source-picker.html`);
  } else {
    void sourcePickerWindow.loadFile(join(__dirname, '../renderer/source-picker.html'));
  }
}

function closeSourcePickerWindow(): void {
  sourcePickerWindow?.close();
}

function showAnnotationWindow(): void {
  if (!latestPreviewCapture) {
    return;
  }

  if (annotationWindow) {
    if (annotationWindow.isMinimized()) {
      annotationWindow.restore();
    }

    annotationWindow.show();
    annotationWindow.focus();
    return;
  }

  annotationWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    title: `${appInfo.name} Annotate`,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  annotationWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  annotationWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  annotationWindow.once('ready-to-show', () => {
    annotationWindow?.show();
  });

  annotationWindow.on('closed', () => {
    annotationWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void annotationWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/annotation.html`);
  } else {
    void annotationWindow.loadFile(join(__dirname, '../renderer/annotation.html'));
  }
}

function closeAnnotationWindow(): void {
  annotationWindow?.close();
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

async function startRegionCapture(): Promise<CaptureActionResponse> {
  if (activeRegionCapture) {
    return {
      mode: 'region',
      status: 'failed',
      message: 'Region capture is already active.',
    };
  }

  const permissionResponse = await verifyScreenCaptureAccess('region');

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

async function verifyScreenCaptureAccess(mode: CaptureMode): Promise<CaptureActionResponse | null> {
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
      mode,
      status: 'permission-required',
      message: error instanceof Error ? error.message : 'Snappd could not access screen sources.',
    };
  }

  return {
    mode,
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

  if (settings.showPostCapturePreview) {
    showPreviewWindow(result);
  }

  return {
    mode: 'region',
    status: 'copied-to-clipboard',
    result,
  };
}

async function captureFullScreen(): Promise<CaptureActionResponse> {
  const permissionResponse = await verifyScreenCaptureAccess('full-screen');

  if (permissionResponse) {
    showPreferencesWindow();
    return permissionResponse;
  }

  const display = displayContainingCursor() ?? screen.getPrimaryDisplay();
  const physicalDisplaySize = {
    width: Math.round(display.bounds.width * display.scaleFactor),
    height: Math.round(display.bounds.height * display.scaleFactor),
  };

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: physicalDisplaySize,
      fetchWindowIcons: false,
    });
    const source = sources.find((candidate) => candidate.display_id === String(display.id));

    if (!source || source.thumbnail.isEmpty()) {
      return {
        mode: 'full-screen',
        status: 'permission-required',
        message: 'Snappd could not capture this display. Check Screen Recording permission.',
      };
    }

    return completeImageCapture('full-screen', source.thumbnail, 'screen');
  } catch (error) {
    showPreferencesWindow();

    return {
      mode: 'full-screen',
      status: 'permission-required',
      message: error instanceof Error ? error.message : 'Snappd could not access screen sources.',
    };
  }
}

async function startWindowCapture(): Promise<CaptureActionResponse> {
  if (activeWindowCapture) {
    return {
      mode: 'window',
      status: 'failed',
      message: 'Window capture is already active.',
    };
  }

  try {
    windowCaptureSources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 480, height: 300 },
      fetchWindowIcons: false,
    });
  } catch (error) {
    showPreferencesWindow();

    return {
      mode: 'window',
      status: 'permission-required',
      message: error instanceof Error ? error.message : 'Snappd could not access window sources.',
    };
  }

  if (windowCaptureSources.length === 0) {
    return {
      mode: 'window',
      status: 'failed',
      message: 'No capturable windows were found.',
    };
  }

  return new Promise((resolve) => {
    activeWindowCapture = resolve;
    showSourcePickerWindow();
  });
}

async function completeWindowCapture(sourceId: string): Promise<void> {
  const resolve = activeWindowCapture;

  if (!resolve) {
    return;
  }

  activeWindowCapture = null;
  closeSourcePickerWindow();
  windowCaptureSources = [];

  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: largestPhysicalDisplaySize(),
      fetchWindowIcons: false,
    });
    const source = sources.find((candidate) => candidate.id === sourceId);

    if (!source || source.thumbnail.isEmpty()) {
      resolve({
        mode: 'window',
        status: 'failed',
        message: 'Selected window could not be captured.',
      });
      return;
    }

    resolve(completeImageCapture('window', source.thumbnail, 'window'));
  } catch (error) {
    resolve({
      mode: 'window',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Selected window could not be captured.',
    });
  }
}

function cancelWindowCapture(): void {
  const resolve = activeWindowCapture;

  activeWindowCapture = null;
  windowCaptureSources = [];
  closeSourcePickerWindow();
  resolve?.({ mode: 'window', status: 'cancelled' });
}

function completeImageCapture(
  mode: CaptureMode,
  image: NativeImage,
  sourceKind: CaptureResult['sourceKind'],
): CaptureActionResponse {
  if (settings.automaticClipboardCopy) {
    clipboard.writeImage(image);
  }

  const size = image.getSize();
  const result: CaptureResult = {
    image: { dataUrl: image.toDataURL() },
    width: size.width,
    height: size.height,
    sourceKind,
    timestamp: new Date().toISOString(),
  };

  if (settings.showPostCapturePreview) {
    showPreviewWindow(result);
  }

  return {
    mode,
    status: 'copied-to-clipboard',
    result,
  };
}

function displayContainingCursor(): Display | null {
  const cursor = screen.getCursorScreenPoint();

  return displayContainingPoint(screen.getAllDisplays(), cursor);
}

function largestPhysicalDisplaySize(): { width: number; height: number } {
  return screen.getAllDisplays().reduce(
    (size, display) => ({
      width: Math.max(size.width, Math.round(display.bounds.width * display.scaleFactor)),
      height: Math.max(size.height, Math.round(display.bounds.height * display.scaleFactor)),
    }),
    { width: 1920, height: 1080 },
  );
}

function toGlobalRect(rect: Rectangle, display: Display): Rectangle {
  return {
    x: rect.x + display.bounds.x,
    y: rect.y + display.bounds.y,
    width: rect.width,
    height: rect.height,
  };
}

async function saveLatestPreviewCapture(): Promise<SaveCaptureResponse> {
  if (!latestPreviewCapture) {
    return {
      status: 'failed',
      message: 'No capture is available to save.',
    };
  }

  try {
    const saveFolder = expandHomeDirectory(settings.saveFolder, homedir());
    const filePath = screenshotFilePath(
      settings.saveFolder,
      latestPreviewCapture.timestamp,
      homedir(),
    );
    const image = nativeImage.createFromDataURL(latestPreviewCapture.image.dataUrl);

    await mkdir(saveFolder, { recursive: true });
    await writeFile(filePath, image.toPNG());

    return {
      status: 'saved',
      filePath,
    };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Could not save screenshot.',
    };
  }
}

function copyLatestPreviewCapture(): void {
  if (!latestPreviewCapture) {
    return;
  }

  clipboard.writeImage(nativeImage.createFromDataURL(latestPreviewCapture.image.dataUrl));
}

async function saveAnnotatedCapture(payload: AnnotationImagePayload): Promise<SaveCaptureResponse> {
  if (!isValidAnnotationPayload(payload)) {
    return {
      status: 'failed',
      message: 'Annotated image payload is invalid.',
    };
  }

  try {
    const timestamp = new Date().toISOString();
    const saveFolder = expandHomeDirectory(settings.saveFolder, homedir());
    const filePath = screenshotFilePath(settings.saveFolder, timestamp, homedir());
    const image = nativeImage.createFromDataURL(payload.dataUrl);

    await mkdir(saveFolder, { recursive: true });
    await writeFile(filePath, image.toPNG());

    return {
      status: 'saved',
      filePath,
    };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Could not save annotated screenshot.',
    };
  }
}

function copyAnnotatedCapture(payload: AnnotationImagePayload): void {
  if (!isValidAnnotationPayload(payload)) {
    return;
  }

  clipboard.writeImage(nativeImage.createFromDataURL(payload.dataUrl));
}

function isValidAnnotationPayload(payload: unknown): payload is AnnotationImagePayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as Partial<AnnotationImagePayload>;

  return (
    typeof candidate.dataUrl === 'string' &&
    candidate.dataUrl.startsWith('data:image/png') &&
    typeof candidate.width === 'number' &&
    candidate.width > 0 &&
    typeof candidate.height === 'number' &&
    candidate.height > 0
  );
}

function applyDockVisibility(): void {
  if (settings.showDockIcon) {
    app.dock?.show();
    return;
  }

  app.dock?.hide();
}

function applyLaunchAtLogin(): void {
  if (!app.isPackaged) {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: settings.launchAtLogin,
  });
}

function settingsResponse(message?: string) {
  return {
    settings,
    shortcutStatus,
    settingsPath: getSettingsFilePath(),
    ...(message ? { message } : {}),
  };
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
      click: () => void startWindowCapture(),
    },
    {
      label: 'Capture Full Screen',
      click: () => void captureFullScreen(),
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

async function updateSettings(nextSettings: unknown): Promise<string | undefined> {
  const normalizedSettings = normalizeSettings(nextSettings);

  if (!isValidShortcut(normalizedSettings.regionShortcut)) {
    return 'Shortcut must include at least one modifier and a key.';
  }

  settings = await writeSettings(normalizedSettings);
  applyDockVisibility();
  applyLaunchAtLogin();
  registerShortcuts();
  refreshTrayMenu();

  if (shortcutStatus.region === 'conflict') {
    return `Could not register ${settings.regionShortcut}. It may already be used by another app.`;
  }

  return undefined;
}

function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.appInfo, () => ({ name: appInfo.name }));
  ipcMain.handle(ipcChannels.settingsGet, () => settingsResponse());
  ipcMain.handle(ipcChannels.settingsUpdate, async (_event, nextSettings: unknown) => {
    const message = await updateSettings(nextSettings);

    return settingsResponse(message);
  });
  ipcMain.handle(ipcChannels.settingsSelectSaveFolder, async () => {
    const options: OpenDialogOptions = {
      title: 'Choose Save Folder',
      defaultPath: expandHomeDirectory(settings.saveFolder, homedir()),
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = preferencesWindow
      ? await dialog.showOpenDialog(preferencesWindow, options)
      : await dialog.showOpenDialog(options);

    return {
      filePath: result.canceled ? null : (result.filePaths[0] ?? null),
    };
  });
  ipcMain.handle(ipcChannels.captureFoundationGet, async () => ({
    foundation: await getCaptureFoundationState(),
  }));
  ipcMain.handle(ipcChannels.capturePermissionOpenSettings, async () => {
    await openScreenRecordingSettings();
  });
  ipcMain.handle(ipcChannels.captureRegion, () => startRegionCapture());
  ipcMain.handle(ipcChannels.captureWindow, () => startWindowCapture());
  ipcMain.handle(ipcChannels.captureFullScreen, () => captureFullScreen());
  ipcMain.handle(
    ipcChannels.regionSelectionComplete,
    async (_event, payload: RegionSelectionPayload) => {
      await completeRegionCapture(payload);
    },
  );
  ipcMain.handle(ipcChannels.regionSelectionCancel, () => {
    cancelRegionCapture();
  });
  ipcMain.handle(ipcChannels.previewGetCapture, () => ({ capture: latestPreviewCapture }));
  ipcMain.handle(ipcChannels.previewSave, () => saveLatestPreviewCapture());
  ipcMain.handle(ipcChannels.previewCopy, () => {
    copyLatestPreviewCapture();
  });
  ipcMain.handle(ipcChannels.previewClose, () => {
    closePreviewWindow();
  });
  ipcMain.handle(ipcChannels.sourcePickerGetSources, () => ({
    sources: windowCaptureSources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnailDataUrl: source.thumbnail.toDataURL(),
    })),
  }));
  ipcMain.handle(ipcChannels.sourcePickerSelect, async (_event, sourceId: unknown) => {
    if (typeof sourceId !== 'string') {
      cancelWindowCapture();
      return;
    }

    await completeWindowCapture(sourceId);
  });
  ipcMain.handle(ipcChannels.sourcePickerCancel, () => {
    cancelWindowCapture();
  });
  ipcMain.handle(ipcChannels.annotationOpen, () => {
    showAnnotationWindow();
  });
  ipcMain.handle(ipcChannels.annotationCopy, (_event, payload: unknown) => {
    if (isValidAnnotationPayload(payload)) {
      copyAnnotatedCapture(payload);
    }
  });
  ipcMain.handle(ipcChannels.annotationSave, (_event, payload: unknown) => {
    if (!isValidAnnotationPayload(payload)) {
      return {
        status: 'failed',
        message: 'Annotated image payload is invalid.',
      } satisfies SaveCaptureResponse;
    }

    return saveAnnotatedCapture(payload);
  });
  ipcMain.handle(ipcChannels.annotationClose, () => {
    closeAnnotationWindow();
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
    applyLaunchAtLogin();
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
