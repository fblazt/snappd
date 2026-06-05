export type CaptureSourceKind = 'screen' | 'window';

export interface CaptureImageData {
  dataUrl: string;
  bytes?: Uint8Array;
}

export interface CaptureResult {
  image: CaptureImageData;
  width: number;
  height: number;
  sourceKind: CaptureSourceKind;
  timestamp: string;
}

export interface CapturePermissionState {
  status: 'granted' | 'denied' | 'restricted' | 'unknown';
  canRequestRecovery: boolean;
  message: string;
}

export interface CaptureSourceSummary {
  id: string;
  name: string;
  kind: CaptureSourceKind;
  displayId?: string;
  thumbnailSize: {
    width: number;
    height: number;
  };
}

export interface DisplaySummary {
  id: number;
  scaleFactor: number;
  bounds: Rectangle;
  workArea: Rectangle;
}

export interface CaptureFoundationState {
  permission: CapturePermissionState;
  sources: CaptureSourceSummary[];
  displays: DisplaySummary[];
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
