import type { Rectangle } from './capture';
import type { AnnotationImagePayload, RegionSelectionPayload } from './ipc';

const maxAnnotationDataUrlLength = 50 * 1024 * 1024;
const maxAnnotationDimension = 20_000;

export function isValidRegionSelectionPayload(value: unknown): value is RegionSelectionPayload {
  if (!isRecord(value) || !Number.isFinite(value.displayId)) {
    return false;
  }

  return isValidRectangle(value.rect);
}

export function isValidAnnotationImagePayload(value: unknown): value is AnnotationImagePayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.dataUrl === 'string' &&
    value.dataUrl.startsWith('data:image/png;base64,') &&
    value.dataUrl.length <= maxAnnotationDataUrlLength &&
    isPositiveSafeDimension(value.width) &&
    isPositiveSafeDimension(value.height)
  );
}

export function isReasonableSaveFolder(value: string): boolean {
  return !hasControlCharacter(value) && (value.startsWith('/') || value.startsWith('~/'));
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function isValidRectangle(value: unknown): value is Rectangle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    isPositiveSafeDimension(value.width) &&
    isPositiveSafeDimension(value.height)
  );
}

function isPositiveSafeDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= maxAnnotationDimension
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
