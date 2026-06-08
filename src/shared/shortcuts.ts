const shortcutModifiers = new Set([
  'Command',
  'Cmd',
  'Control',
  'Ctrl',
  'CommandOrControl',
  'Alt',
  'Option',
  'Shift',
  'Super',
  'Meta',
]);

export function isValidShortcut(shortcut: string): boolean {
  const parts = shortcut.split('+').flatMap((part) => {
    const trimmedPart = part.trim();
    return trimmedPart ? [trimmedPart] : [];
  });
  const hasModifier = parts.some((part) => shortcutModifiers.has(part));
  const key = parts.at(-1);

  return Boolean(hasModifier && key && !shortcutModifiers.has(key));
}
