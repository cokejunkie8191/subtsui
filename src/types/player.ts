export type PlaybackStatus = 'playing' | 'paused' | 'stopped'
export type LoopMode = 'none' | 'all' | 'one'

export type MpvStatus = {
  paused: boolean
  position: number    // 秒
  duration: number    // 秒
  volume: number      // 0-100
  path: string | null
}
