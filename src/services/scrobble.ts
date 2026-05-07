// src/services/scrobble.ts
import type { Song } from '../types/subsonic'
import type { SubsonicClient } from './subsonic'

type ScrobbleFn = SubsonicClient['scrobble']

export type ScrobbleOptions = {
  /**
   * true の場合、再生時間 50%（最大 240秒）経過時に submission=true を送信する。
   * Subsonic サーバ側で Last.fm 連携を設定済みなら不要。デフォルト false。
   */
  submitOnComplete?: boolean
}

export class ScrobbleService {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly submitOnComplete: boolean

  constructor(
    private readonly scrobble: ScrobbleFn,
    opts: ScrobbleOptions = {},
  ) {
    this.submitOnComplete = opts.submitOnComplete ?? false
  }

  onSongStart(song: Song): void {
    this.cancelPending()

    if (song.duration < 30) return

    // Now Playing 即時通知（常に送る）
    this.scrobble(song.id, { submission: false })

    // 完了スクロブル（オプション）
    if (!this.submitOnComplete) return

    const startedAt = Date.now()
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
