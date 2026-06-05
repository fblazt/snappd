import { contextBridge } from 'electron';
import { appInfo } from '../shared/app-info';

const snappd = {
  getAppName: () => appInfo.name,
} as const;

contextBridge.exposeInMainWorld('snappd', snappd);

export type SnappdApi = typeof snappd;
