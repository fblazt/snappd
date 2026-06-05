import { describe, expect, it } from 'vitest';
import { appInfo, formatScreenshotFilename } from './app-info';

describe('appInfo', () => {
  it('uses the Snappd product name', () => {
    expect(appInfo.name).toBe('Snappd');
  });
});

describe('formatScreenshotFilename', () => {
  it('formats screenshot filenames with stable zero-padded fields', () => {
    const date = new Date(2026, 5, 5, 4, 3, 2);

    expect(formatScreenshotFilename(date)).toBe('Snappd 2026-06-05 04.03.02.png');
  });
});
