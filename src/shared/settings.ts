export interface AppSettings {
  regionShortcut: string;
  saveFolder: string;
  launchAtLogin: boolean;
  showDockIcon: boolean;
  showPostCapturePreview: boolean;
  automaticClipboardCopy: boolean;
}

export const defaultSettings = {
  regionShortcut: 'Command+Shift+2',
  saveFolder: '~/Pictures/Snappd',
  launchAtLogin: false,
  showDockIcon: false,
  showPostCapturePreview: true,
  automaticClipboardCopy: true,
} as const satisfies AppSettings;

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return { ...defaultSettings };
  }

  return {
    regionShortcut: readString(value.regionShortcut, defaultSettings.regionShortcut),
    saveFolder: readString(value.saveFolder, defaultSettings.saveFolder),
    launchAtLogin: readBoolean(value.launchAtLogin, defaultSettings.launchAtLogin),
    showDockIcon: readBoolean(value.showDockIcon, defaultSettings.showDockIcon),
    showPostCapturePreview: readBoolean(
      value.showPostCapturePreview,
      defaultSettings.showPostCapturePreview,
    ),
    automaticClipboardCopy: readBoolean(
      value.automaticClipboardCopy,
      defaultSettings.automaticClipboardCopy,
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
