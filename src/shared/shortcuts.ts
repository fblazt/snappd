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
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const hasModifier = parts.some((part) => shortcutModifiers.has(part));
  const key = parts.at(-1);

  return Boolean(hasModifier && key && !shortcutModifiers.has(key));
}
