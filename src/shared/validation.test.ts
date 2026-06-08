import { describe, expect, it } from 'vitest';
import {
  isReasonableSaveFolder,
  isValidAnnotationImagePayload,
  isValidRegionSelectionPayload,
} from './validation';

describe('isValidRegionSelectionPayload', () => {
  it('accepts finite display id and positive rectangle dimensions', () => {
    expect(
      isValidRegionSelectionPayload({
        displayId: 1,
        rect: { x: 0, y: 10, width: 100, height: 80 },
      }),
    ).toBe(true);
  });

  it('rejects malformed selection payloads', () => {
    expect(isValidRegionSelectionPayload({ displayId: '1', rect: {} })).toBe(false);
    expect(
      isValidRegionSelectionPayload({
        displayId: 1,
        rect: { x: 0, y: 0, width: 0, height: 80 },
      }),
    ).toBe(false);
    expect(
      isValidRegionSelectionPayload({
        displayId: 1,
        rect: { x: Number.NaN, y: 0, width: 10, height: 80 },
      }),
    ).toBe(false);
  });
});

describe('isValidAnnotationImagePayload', () => {
  it('accepts bounded PNG data URLs and dimensions', () => {
    expect(
      isValidAnnotationImagePayload({
        dataUrl: 'data:image/png;base64,abc',
        width: 100,
        height: 80,
      }),
    ).toBe(true);
  });

  it('rejects non-PNG, empty, or oversized annotation payloads', () => {
    expect(
      isValidAnnotationImagePayload({ dataUrl: 'data:image/jpeg;base64,abc', width: 1, height: 1 }),
    ).toBe(false);
    expect(
      isValidAnnotationImagePayload({ dataUrl: 'data:image/png;base64,abc', width: 0, height: 1 }),
    ).toBe(false);
    expect(
      isValidAnnotationImagePayload({
        dataUrl: 'data:image/png;base64,abc',
        width: 20_001,
        height: 1,
      }),
    ).toBe(false);
  });
});

describe('isReasonableSaveFolder', () => {
  it('accepts absolute and home-relative macOS paths', () => {
    expect(isReasonableSaveFolder('/tmp/snappd')).toBe(true);
    expect(isReasonableSaveFolder('~/Pictures/Snappd')).toBe(true);
  });

  it('rejects relative paths and control characters', () => {
    expect(isReasonableSaveFolder('Pictures/Snappd')).toBe(false);
    expect(isReasonableSaveFolder('/tmp/snap\nd')).toBe(false);
  });
});
