export type DoubleTapResult = 'quit' | 'first-tap' | 'ignored'

export function detectDoubleTap(
  input: string,
  lastTap: number,
  now: number = Date.now(),
  windowMs: number = 300
): DoubleTapResult {
  if (input !== 'q') return 'ignored'
  if (now - lastTap < windowMs) return 'quit'
  return 'first-tap'
}
