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
  private currentSong: Song | null = null
  private songStartedAtMs = 0
  private completed = false
  private readonly submitOnComplete: boolean

  constructor(
    private readonly scrobble: ScrobbleFn,
    opts: ScrobbleOptions = {},
  ) {
    this.submitOnComplete = opts.submitOnComplete ?? false
  }

  onSongStart(song: Song): void {
    // 30秒未満の曲はそもそもスクロブル対象外（Last.fm 仕様）
    if (song.duration < 30) {
      this.currentSong = null
      this.completed = false
      return
    }
    this.currentSong = song
    this.songStartedAtMs = Date.now()
    this.completed = false
    // Now Playing 即時通知
    this.scrobble(song.id, { submission: false })
  }

  /**
   * 再生ポジション（秒）の更新ごとに呼ぶ。
   * 実際の再生時間が閾値（50% または 240秒の早い方）を超えたタイミングで
   * 一度だけ submission=true を送信する。ポーズ中は position が進まないので
   * 自然に発火が遅延する。
   */
  onPositionUpdate(positionSec: number): void {
    if (!this.submitOnComplete) return
    if (!this.currentSong) return
    if (this.completed) return
    const threshold = Math.min(this.currentSong.duration * 0.5, 240)
    if (positionSec < threshold) return
    this.completed = true
    this.scrobble(this.currentSong.id, {
      submission: true,
      time: this.songStartedAtMs,
    })
  }

  onSongSkip(): void {
    this.currentSong = null
    this.completed = false
  }

  destroy(): void {
    this.currentSong = null
  }
}
