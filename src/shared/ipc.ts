import type { AppSettings } from './settings';

export const ipcChannels = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  captureRegion: 'capture:region',
  captureWindow: 'capture:window',
  captureFullScreen: 'capture:full-screen',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];

export interface AppInfoResponse {
  name: string;
}

export interface SettingsResponse {
  settings: AppSettings;
  shortcutStatus: ShortcutStatus;
  settingsPath: string;
}

export interface ShortcutStatus {
  region: 'registered' | 'conflict' | 'not-registered';
}

export type CaptureMode = 'region' | 'window' | 'full-screen';

export interface CapturePlaceholderResponse {
  mode: CaptureMode;
  status: 'not-implemented';
}
