// src/framework/keys.ts
import type { KeyEvent } from './Screen'

/**
 * Enter キー検出。ターミナルによっては LF (\n) を送り、その場合 Ink の
 * key.return が false になるため、生の改行コードもチェックする。
 */
export function isEnter(e: KeyEvent): boolean {
  return !!e.key.return || e.input === '\r' || e.input === '\n'
}
