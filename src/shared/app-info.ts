export const appInfo = {
  name: 'Snappd',
  defaultSaveFolderName: 'Snappd',
} as const;

export function formatScreenshotFilename(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `Snappd ${year}-${month}-${day} ${hours}.${minutes}.${seconds}.png`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
