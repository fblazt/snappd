import { contextBridge, ipcRenderer } from 'electron';
import {
  type AppInfoResponse,
  type CaptureFoundationResponse,
  type CapturePlaceholderResponse,
  ipcChannels,
  type PreviewCaptureResponse,
  type RegionSelectionPayload,
  type SaveCaptureResponse,
  type SaveFolderSelectionResponse,
  type SettingsResponse,
  type SourcePickerSourcesResponse,
} from '../shared/ipc';
import type { AppSettings } from '../shared/settings';

const snappd = {
  getAppInfo: (): Promise<AppInfoResponse> => ipcRenderer.invoke(ipcChannels.appInfo),
  getSettings: (): Promise<SettingsResponse> => ipcRenderer.invoke(ipcChannels.settingsGet),
  updateSettings: (settings: AppSettings): Promise<SettingsResponse> =>
    ipcRenderer.invoke(ipcChannels.settingsUpdate, settings),
  selectSaveFolder: (): Promise<SaveFolderSelectionResponse> =>
    ipcRenderer.invoke(ipcChannels.settingsSelectSaveFolder),

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
  completeRegionSelection: (payload: RegionSelectionPayload): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.regionSelectionComplete, payload),
  cancelRegionSelection: (): Promise<void> => ipcRenderer.invoke(ipcChannels.regionSelectionCancel),
  getPreviewCapture: (): Promise<PreviewCaptureResponse> =>
    ipcRenderer.invoke(ipcChannels.previewGetCapture),
  savePreviewCapture: (): Promise<SaveCaptureResponse> =>
    ipcRenderer.invoke(ipcChannels.previewSave),
  copyPreviewCapture: (): Promise<void> => ipcRenderer.invoke(ipcChannels.previewCopy),
  closePreview: (): Promise<void> => ipcRenderer.invoke(ipcChannels.previewClose),
  getSourcePickerSources: (): Promise<SourcePickerSourcesResponse> =>
    ipcRenderer.invoke(ipcChannels.sourcePickerGetSources),
  selectSourcePickerSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.sourcePickerSelect, sourceId),
  cancelSourcePicker: (): Promise<void> => ipcRenderer.invoke(ipcChannels.sourcePickerCancel),
} as const;

contextBridge.exposeInMainWorld('snappd', snappd);

export type SnappdApi = typeof snappd;
