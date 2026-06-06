import type { CaptureFoundationState, CaptureResult, Rectangle } from './capture';
import type { AppSettings } from './settings';

export const ipcChannels = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  captureFoundationGet: 'capture:foundation:get',
  capturePermissionOpenSettings: 'capture:permission:open-settings',
  captureRegion: 'capture:region',
  captureWindow: 'capture:window',
  captureFullScreen: 'capture:full-screen',
  regionSelectionComplete: 'region-selection:complete',
  regionSelectionCancel: 'region-selection:cancel',
  previewGetCapture: 'preview:get-capture',
  previewSave: 'preview:save',
  previewCopy: 'preview:copy',
  previewClose: 'preview:close',
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

export interface CaptureFoundationResponse {
  foundation: CaptureFoundationState;
}

export type CaptureMode = 'region' | 'window' | 'full-screen';

export interface RegionSelectionPayload {
  displayId: number;
  rect: Rectangle;
}

export type CaptureActionResponse =
  | {
      mode: CaptureMode;
      status: 'not-implemented' | 'cancelled' | 'permission-required' | 'failed';
      message?: string;
    }
  | {
      mode: CaptureMode;
      status: 'copied-to-clipboard';
      result: CaptureResult;
    };

export type CapturePlaceholderResponse = CaptureActionResponse;

export interface PreviewCaptureResponse {
  capture: CaptureResult | null;
}

export type SaveCaptureResponse =
  | {
      status: 'saved';
      filePath: string;
    }
  | {
      status: 'failed';
      message: string;
    };
