import { describe, expect, it } from 'vitest';
import { displayContainingPoint } from './displays';

const displays = [
  { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } },
  { id: 2, bounds: { x: 1440, y: 0, width: 1280, height: 720 } },
  { id: 3, bounds: { x: -1024, y: 0, width: 1024, height: 768 } },
];

describe('displayContainingPoint', () => {
  it('returns the display containing the cursor point', () => {
    expect(displayContainingPoint(displays, { x: 1600, y: 100 })?.id).toBe(2);
  });

  it('supports displays positioned to the left of the primary display', () => {
    expect(displayContainingPoint(displays, { x: -20, y: 100 })?.id).toBe(3);
  });

  it('treats right and bottom edges as outside the display', () => {
    expect(displayContainingPoint(displays, { x: 1440, y: 900 })).toBeNull();
  });
});
