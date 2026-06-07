import { describe, expect, it } from 'vitest';
import { ipcChannels } from './ipc';

describe('ipcChannels', () => {
  it('uses unique channel names so handlers cannot collide', () => {
    const channelNames = Object.values(ipcChannels);

    expect(new Set(channelNames).size).toBe(channelNames.length);
  });

  it('keeps region selection channels namespaced away from capture commands', () => {
    expect(ipcChannels.regionSelectionComplete).toBe('region-selection:complete');
    expect(ipcChannels.regionSelectionCancel).toBe('region-selection:cancel');
  });

  it('keeps preferences mutation channels explicit', () => {
    expect(ipcChannels.settingsUpdate).toBe('settings:update');
    expect(ipcChannels.settingsSelectSaveFolder).toBe('settings:select-save-folder');
  });
});
