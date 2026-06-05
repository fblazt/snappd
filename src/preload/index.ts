import { contextBridge, ipcRenderer } from 'electron';
import { type AppInfoResponse, type CapturePlaceholderResponse, ipcChannels } from '../shared/ipc';

const snappd = {
  getAppInfo: (): Promise<AppInfoResponse> => ipcRenderer.invoke(ipcChannels.appInfo),
  captureRegion: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureRegion),
  captureWindow: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureWindow),
  captureFullScreen: (): Promise<CapturePlaceholderResponse> =>
    ipcRenderer.invoke(ipcChannels.captureFullScreen),
} as const;

contextBridge.exposeInMainWorld('snappd', snappd);

export type SnappdApi = typeof snappd;
