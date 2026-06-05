import { desktopCapturer, screen, shell, systemPreferences } from 'electron';
import type {
  CaptureFoundationState,
  CapturePermissionState,
  CaptureSourceKind,
  CaptureSourceSummary,
  DisplaySummary,
} from '../shared/capture';

export function getCapturePermissionState(): CapturePermissionState {
  if (process.platform !== 'darwin') {
    return {
      status: 'unknown',
      canRequestRecovery: false,
      message: 'Screen Recording permission checks are only available on macOS.',
    };
  }

  const status = systemPreferences.getMediaAccessStatus('screen');

  if (status === 'granted') {
    return {
      status: 'granted',
      canRequestRecovery: false,
      message: 'Screen Recording permission is available.',
    };
  }

  if (status === 'denied' || status === 'restricted') {
    return {
      status,
      canRequestRecovery: true,
      message: 'Snappd needs Screen Recording permission to capture screenshots.',
    };
  }

  return {
    status: 'unknown',
    canRequestRecovery: true,
    message: 'Snappd may need Screen Recording permission before capture can work.',
  };
}

export async function openScreenRecordingSettings(): Promise<void> {
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  );
}

export async function getCaptureSources(): Promise<CaptureSourceSummary[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 },
      fetchWindowIcons: false,
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: getSourceKind(source.id),
      displayId: source.display_id || undefined,
      thumbnailSize: source.thumbnail.getSize(),
    }));
  } catch {
    return [];
  }
}

export function getDisplays(): DisplaySummary[] {
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    scaleFactor: display.scaleFactor,
    bounds: display.bounds,
    workArea: display.workArea,
  }));
}

export async function getCaptureFoundationState(): Promise<CaptureFoundationState> {
  return {
    permission: getCapturePermissionState(),
    sources: await getCaptureSources(),
    displays: getDisplays(),
  };
}

function getSourceKind(sourceId: string): CaptureSourceKind {
  return sourceId.startsWith('window:') ? 'window' : 'screen';
}
