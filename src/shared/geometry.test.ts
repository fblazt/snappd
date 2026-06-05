import { describe, expect, it } from 'vitest';
import { clampRectToBounds, toDisplayRelativeRect, toPhysicalRect } from './geometry';

describe('geometry conversion', () => {
  it('converts display-independent pixels to physical pixels on Retina displays', () => {
    expect(
      toPhysicalRect(
        { x: 120, y: 80, width: 300, height: 160 },
        { bounds: { x: 100, y: 50, width: 800, height: 600 }, scaleFactor: 2 },
      ),
    ).toEqual({ x: 40, y: 60, width: 600, height: 320 });
  });

  it('keeps coordinates unchanged on 1x displays except for display-relative offset', () => {
    expect(
      toPhysicalRect(
        { x: -900, y: 20, width: 200, height: 100 },
        { bounds: { x: -1000, y: 0, width: 1000, height: 800 }, scaleFactor: 1 },
      ),
    ).toEqual({ x: 100, y: 20, width: 200, height: 100 });
  });

  it('converts global coordinates to display-relative coordinates', () => {
    expect(
      toDisplayRelativeRect(
        { x: 1440, y: 100, width: 320, height: 240 },
        { bounds: { x: 1280, y: 0, width: 1280, height: 720 }, scaleFactor: 1 },
      ),
    ).toEqual({ x: 160, y: 100, width: 320, height: 240 });
  });

  it('clamps rectangles to display bounds', () => {
    expect(
      clampRectToBounds(
        { x: 90, y: 80, width: 40, height: 50 },
        { x: 100, y: 100, width: 200, height: 120 },
      ),
    ).toEqual({ x: 100, y: 100, width: 30, height: 30 });
  });
});
