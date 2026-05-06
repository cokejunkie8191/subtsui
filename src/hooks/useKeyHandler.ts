// src/hooks/useKeyHandler.ts
import { useInput } from 'ink'
import { useRef } from 'react'
import { findAction } from '../config/keybinds'
import type { AppConfig } from '../types/config'

type Handler = (category: string, action: string) => void

export function useKeyHandler(config: AppConfig, onAction: Handler, isActive = true) {
  const lastZRef = useRef<number>(0)

  useInput((input, key) => {
    let pressed = input
    if (key.return) pressed = 'return'
    else if (key.escape) pressed = 'escape'
    else if (key.tab) pressed = key.shift ? 'S-tab' : 'tab'
    else if (key.upArrow) pressed = 'up'
    else if (key.downArrow) pressed = 'down'
    else if (key.leftArrow) pressed = 'left'
    else if (key.rightArrow) pressed = 'right'
    else if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    if (pressed === 'Z') {
      const now = Date.now()
      if (now - lastZRef.current < 300) {
        onAction('global', 'quit')
        return
      }
      lastZRef.current = now
      return
    }

    const action = findAction(pressed, config.keybinds)
    if (action) onAction(action.category, action.action)
  }, { isActive })
}
