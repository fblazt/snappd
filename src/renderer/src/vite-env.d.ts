/// <reference types="vite/client" />

import type { SnappdApi } from '../../preload';

declare global {
  interface Window {
    snappd: SnappdApi;
  }
}
