// src/framework/keyRouter.ts
import type { Screen, KeyEvent } from './Screen'

export type RouteDecision =
  | 'blocked'      // Layer 3 が遮断（Esc 以外）
  | 'screen-only'  // Layer 2 だけ評価、Layer 1 はスキップ
  | 'screen'       // Layer 2 → 1 の通常フロー

export function decideRoute(
  e: KeyEvent,
  ctx: { textInputFocused: boolean; screen: Screen; modal: Screen | null }
): RouteDecision {
  // Layer 3: TextInput active
  if (ctx.textInputFocused && !e.key.escape) return 'blocked'

  // Modal がアクティブで isModal=true なら Layer 1 をスキップ
  const active = ctx.modal ?? ctx.screen
  if (active.isModal) return 'screen-only'

  return 'screen'
}

export function resolveActiveScreen(
  modal: Screen | null,
  topOfStack: Screen | undefined
): Screen | null {
  return modal ?? topOfStack ?? null
}
