export const ipcChannels = {
  appInfo: 'app:info',
  captureRegion: 'capture:region',
  captureWindow: 'capture:window',
  captureFullScreen: 'capture:full-screen',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];

export interface AppInfoResponse {
  name: string;
}

export type CaptureMode = 'region' | 'window' | 'full-screen';

export interface CapturePlaceholderResponse {
  mode: CaptureMode;
  status: 'not-implemented';
}
