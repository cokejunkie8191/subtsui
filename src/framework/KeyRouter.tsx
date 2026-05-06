// src/framework/KeyRouter.tsx
import React, { useRef } from 'react'
import { useInput } from 'ink'
import { useNavStore } from '../stores/nav.store'
import { decideRoute, resolveActiveScreen } from './keyRouter'
import type { KeyEvent } from './Screen'

type GlobalHandler = (e: KeyEvent) => void

type Props = {
  /** Layer 1 のグローバルキー処理。app.tsx から渡される */
  onGlobalKey: GlobalHandler
  children: React.ReactNode
}

export function KeyRouter({ onGlobalKey, children }: Props) {
  const lastZRef = useRef<number>(0)

  const activeTab = useNavStore(s => s.activeTab)
  const stacks = useNavStore(s => s.stacks)
  const modal = useNavStore(s => s.modal)
  const textInputFocused = useNavStore(s => s.textInputFocused)

  useInput((input, key) => {
    const e: KeyEvent = { input, key }

    if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    const topOfStack = stacks[activeTab][stacks[activeTab].length - 1]
    const active = resolveActiveScreen(modal, topOfStack)
    if (!active) return

    const route = decideRoute(e, { textInputFocused, screen: active, modal })

    if (route === 'blocked') return

    // Layer 2: Screen の onKey
    if (active.onKey?.(e)) return

    if (route === 'screen-only') return

    // Z Z double-tap (Layer 1)
    if (input === 'Z') {
      const now = Date.now()
      if (now - lastZRef.current < 300) {
        process.exit(0)
      }
      lastZRef.current = now
      return
    }

    // Layer 1
    onGlobalKey(e)
  })

  return <>{children}</>
}
