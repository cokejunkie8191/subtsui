// src/stores/status.store.ts
import { create } from 'zustand'

export type StatusLevel = 'info' | 'warn' | 'error'

type StatusState = {
  message: string | null
  level: StatusLevel | null

  setStatus: (msg: string, level: StatusLevel, autoHideMs?: number) => void
  clear: () => void
}

const DEFAULT_HIDE_MS: Record<StatusLevel, number> = {
  info: 3000,
  warn: 5000,
  error: 8000,
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useStatusStore = create<StatusState>((set) => ({
  message: null,
  level: null,

  setStatus: (msg, level, autoHideMs) => {
    if (timer) clearTimeout(timer)
    set({ message: msg, level })
    const hide = autoHideMs ?? DEFAULT_HIDE_MS[level]
    timer = setTimeout(() => {
      set({ message: null, level: null })
      timer = null
    }, hide)
  },

  clear: () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    set({ message: null, level: null })
  },
}))
