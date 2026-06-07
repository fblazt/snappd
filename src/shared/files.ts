import { join } from 'node:path';
import { appInfo, formatScreenshotFilename } from './app-info';

export function expandHomeDirectory(path: string, homeDirectory: string): string {
  if (path === '~') {
    return homeDirectory;
  }

  if (path.startsWith('~/')) {
    return join(homeDirectory, path.slice(2));
  }

  return path;
}

export function defaultSaveFolder(homeDirectory: string): string {
  return join(homeDirectory, 'Pictures', appInfo.defaultSaveFolderName);
}

export function screenshotFilePath(
  saveFolder: string,
  timestamp: string,
  homeDirectory: string,
): string {
  return join(
    expandHomeDirectory(saveFolder, homeDirectory),
    formatScreenshotFilename(new Date(timestamp)),
  );
}
