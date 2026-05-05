// src/services/scrobble.ts
import type { Song } from '../types/subsonic'
import type { SubsonicClient } from './subsonic'

type ScrobbleFn = SubsonicClient['scrobble']

export class ScrobbleService {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly scrobble: ScrobbleFn) {}

  onSongStart(song: Song): void {
    this.cancelPending()

    if (song.duration < 30) return

    const startedAt = Date.now()

    // Now Playing 即時通知
    this.scrobble(song.id, { submission: false })

    // 完了スクロブル（Last.fm 標準: 50% または 240秒の早い方）
    const thresholdMs = Math.min(song.duration * 0.5, 240) * 1000
    this.timer = setTimeout(() => {
      this.scrobble(song.id, { submission: true, time: startedAt })
    }, thresholdMs)
  }

  onSongSkip(): void {
    this.cancelPending()
  }

  destroy(): void {
    this.cancelPending()
  }

  private cancelPending(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
