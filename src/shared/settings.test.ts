import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('returns defaults when settings are missing', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings);
  });

  it('preserves valid settings', () => {
    expect(
      normalizeSettings({
        regionShortcut: 'Command+Shift+3',
        saveFolder: '/tmp/snappd',
        launchAtLogin: true,
        showDockIcon: true,
        showPostCapturePreview: false,
        automaticClipboardCopy: false,
      }),
    ).toEqual({
      regionShortcut: 'Command+Shift+3',
      saveFolder: '/tmp/snappd',
      launchAtLogin: true,
      showDockIcon: true,
      showPostCapturePreview: false,
      automaticClipboardCopy: false,
    });
  });

  it('falls back per field when settings are invalid', () => {
    expect(
      normalizeSettings({
        regionShortcut: '',
        saveFolder: 7,
        launchAtLogin: 'yes',
        showDockIcon: false,
      }),
    ).toEqual(defaultSettings);
  });

  it('preserves valid fields while replacing invalid fields', () => {
    expect(
      normalizeSettings({
        regionShortcut: 'Command+Shift+7',
        saveFolder: '',
        launchAtLogin: true,
        showDockIcon: 'no',
        showPostCapturePreview: false,
        automaticClipboardCopy: false,
      }),
    ).toEqual({
      ...defaultSettings,
      regionShortcut: 'Command+Shift+7',
      launchAtLogin: true,
      showPostCapturePreview: false,
      automaticClipboardCopy: false,
    });
  });
});
