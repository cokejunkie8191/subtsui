// src/framework/ServiceContext.tsx
import React, { createContext, useContext } from 'react'
import type { SubsonicClient } from '../services/subsonic'
import type { MpvClient } from '../services/mpv'
import type { ScrobbleService } from '../services/scrobble'
import type { AppConfig } from '../types/config'
import type { Song } from '../types/subsonic'

export type PlaybackController = {
  togglePause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  volumeDelta: (delta: number) => Promise<void>
  seekRelative: (sec: number) => Promise<void>
  seekTo: (sec: number) => Promise<void>
  toggleLoopMode: () => void
  /** 指定の曲を即座に再生（キュー操作を伴わない） */
  playSong: (song: Song) => Promise<void>
}

export type Services = {
  subsonic: SubsonicClient
  mpv: MpvClient
  scrobble: ScrobbleService
  controller: PlaybackController
  config: AppConfig
}

const ServiceContext = createContext<Services | null>(null)

export function ServiceProvider({ value, children }: { value: Services; children: React.ReactNode }) {
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
}

export function useServices(): Services {
  const ctx = useContext(ServiceContext)
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider')
  return ctx
}

let _controller: PlaybackController | null = null

export function setGlobalController(c: PlaybackController | null) {
  _controller = c
}

export function triggerPlay(song: Song) {
  _controller?.playSong(song)
}
