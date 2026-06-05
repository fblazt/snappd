import { contextBridge, ipcRenderer } from 'electron';
import {
  type AppInfoResponse,
  type CaptureFoundationResponse,
  type CapturePlaceholderResponse,
  ipcChannels,
  type SettingsResponse,
} from '../shared/ipc';
import type { AppSettings } from '../shared/settings';

const snappd = {
  getAppInfo: (): Promise<AppInfoResponse> => ipcRenderer.invoke(ipcChannels.appInfo),
  getSettings: (): Promise<SettingsResponse> => ipcRenderer.invoke(ipcChannels.settingsGet),
  updateSettings: (settings: AppSettings): Promise<SettingsResponse> =>
    ipcRenderer.invoke(ipcChannels.settingsUpdate, settings),
  getCaptureFoundation: (): Promise<CaptureFoundationResponse> =>
    ipcRenderer.invoke(ipcChannels.captureFoundationGet),
  openScreenRecordingSettings: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.capturePermissionOpenSettings),
  captureRegion: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureRegion),
  captureWindow: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureWindow),
  captureFullScreen: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureFullScreen),
} as const;

contextBridge.exposeInMainWorld('snappd', snappd);

export type SnappdApi = typeof snappd;
