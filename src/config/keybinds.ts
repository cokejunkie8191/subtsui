const KEY_ALIASES: Record<string, string> = {
  enter: 'return',
  cr: 'return',
  esc: 'escape',
}

export function normalizeKey(key: string): string {
  return KEY_ALIASES[key.toLowerCase()] ?? key
}

export function keyMatches(pressed: string, configured: string[]): boolean {
  const normalized = normalizeKey(pressed)
  return configured.some(k => normalizeKey(k) === normalized)
}

export type KeybindAction = string

export function findAction(
  pressed: string,
  keybinds: Record<string, Record<string, string[]>>
): { category: string; action: string } | null {
  for (const [category, actions] of Object.entries(keybinds)) {
    for (const [action, keys] of Object.entries(actions)) {
      if (keyMatches(pressed, keys)) return { category, action }
    }
  }
  return null
}
