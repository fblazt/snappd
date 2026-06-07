import { describe, expect, it } from 'vitest';
import { isValidShortcut } from './shortcuts';

describe('isValidShortcut', () => {
  it('accepts shortcuts with a modifier and key', () => {
    expect(isValidShortcut('Command+Shift+2')).toBe(true);
  });

  it('accepts Electron modifier aliases used by accelerator strings', () => {
    expect(isValidShortcut('CommandOrControl+Alt+K')).toBe(true);
  });

  it('rejects shortcuts without a modifier', () => {
    expect(isValidShortcut('2')).toBe(false);
  });

  it('rejects shortcuts that only contain modifiers', () => {
    expect(isValidShortcut('Command+Shift')).toBe(false);
  });
});
