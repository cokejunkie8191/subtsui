// src/framework/Screen.ts
import type { ReactNode } from 'react'

export type KeyEvent = {
  input: string
  key: {
    return?: boolean
    escape?: boolean
    tab?: boolean
    shift?: boolean
    ctrl?: boolean
    upArrow?: boolean
    downArrow?: boolean
    leftArrow?: boolean
    rightArrow?: boolean
  }
}

export type Screen = {
  /** Unique ID. Use 'album-detail:42' style with colon-separated params. */
  id: string
  /** For tab header / breadcrumb display */
  title: string
  render: () => ReactNode
  /** Return true to consume the key (skip Layer 1) */
  onKey?: (e: KeyEvent) => boolean
  onMount?: () => void
  onUnmount?: () => void
  /** When true, Layer 1 (global keys) is blocked */
  isModal?: boolean
}
