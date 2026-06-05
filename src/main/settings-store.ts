import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import { type AppSettings, normalizeSettings } from '../shared/settings';

const settingsFileName = 'settings.json';

export function getSettingsFilePath(): string {
  return join(app.getPath('userData'), settingsFileName);
}

export async function readSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsFilePath();

  try {
    const content = await readFile(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(content));
  } catch {
    const settings = normalizeSettings(null);
    await writeSettings(settings);
    return settings;
  }
}

export async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  const normalizedSettings = normalizeSettings(settings);
  const settingsPath = getSettingsFilePath();

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, 'utf8');

  return normalizedSettings;
}
