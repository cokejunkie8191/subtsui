// src/stores/player.store.ts
import { create } from 'zustand'
import type { Song } from '../types/subsonic'
import type { PlaybackStatus, LoopMode, MpvStatus } from '../types/player'

type PlayerState = {
  status: PlaybackStatus
  currentSong: Song | null
  position: number
  duration: number
  volume: number
  loopMode: LoopMode
  error: string | null
  syncFromMpv: (status: MpvStatus) => void
  setCurrentSong: (song: Song | null) => void
  setVolume: (v: number) => void
  setLoopMode: (m: LoopMode) => void
  setError: (msg: string | null) => void
  nextLoopMode: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'stopped',
  currentSong: null,
  position: 0,
  duration: 0,
  volume: 80,
  loopMode: 'none',
  error: null,

  syncFromMpv: (mpv) => set({
    status: mpv.paused ? 'paused' : mpv.path ? 'playing' : 'stopped',
    position: mpv.position,
    duration: mpv.duration,
    volume: mpv.volume,
  }),

  setCurrentSong: (song) => set({ currentSong: song }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(100, v)) }),
  setLoopMode: (m) => set({ loopMode: m }),
  setError: (msg) => set({ error: msg }),

  nextLoopMode: () => {
    const order: LoopMode[] = ['none', 'all', 'one']
    const cur = get().loopMode
    const next = order[(order.indexOf(cur) + 1) % order.length]
    set({ loopMode: next })
  },
}))
