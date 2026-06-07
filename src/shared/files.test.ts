import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultSaveFolder, expandHomeDirectory, screenshotFilePath } from './files';

describe('expandHomeDirectory', () => {
  it('expands a bare home marker', () => {
    expect(expandHomeDirectory('~', '/Users/tester')).toBe('/Users/tester');
  });

  it('expands a home-relative path', () => {
    expect(expandHomeDirectory('~/Pictures/Snappd', '/Users/tester')).toBe(
      join('/Users/tester', 'Pictures', 'Snappd'),
    );
  });

  it('leaves absolute paths unchanged', () => {
    expect(expandHomeDirectory('/tmp/snappd', '/Users/tester')).toBe('/tmp/snappd');
  });

  it('does not expand paths that only start with a tilde-like prefix', () => {
    expect(expandHomeDirectory('~backup/Snappd', '/Users/tester')).toBe('~backup/Snappd');
  });
});

describe('defaultSaveFolder', () => {
  it('uses the Snappd folder under Pictures', () => {
    expect(defaultSaveFolder('/Users/tester')).toBe(join('/Users/tester', 'Pictures', 'Snappd'));
  });
});

describe('screenshotFilePath', () => {
  it('combines the configured folder with the capture timestamp filename', () => {
    expect(screenshotFilePath('~/Pictures/Snappd', '2026-06-05T04:03:02', '/Users/tester')).toBe(
      join('/Users/tester', 'Pictures', 'Snappd', 'Snappd 2026-06-05 04.03.02.png'),
    );
  });
});
