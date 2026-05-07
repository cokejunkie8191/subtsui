// tests/unit/scrobble.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import lolex from 'lolex'
import { ScrobbleService } from '../../src/services/scrobble'
import type { Song } from '../../src/types/subsonic'

const makeSong = (duration: number): Song => ({
  id: 'song-1',
  title: 'Test',
  artist: 'Artist',
  artistId: 'a1',
  album: 'Album',
  albumId: 'al1',
  duration,
  rating: 0,
})

describe('ScrobbleService', () => {
  let scrobbleFn: ReturnType<typeof mock>
  let service: ScrobbleService

  beforeEach(() => {
    scrobbleFn = mock(() => Promise.resolve())
    service = new ScrobbleService(scrobbleFn as any, { submitOnComplete: true })
  })

  test('30秒未満の曲はスクロブルリクエストを送らない', async () => {
    service.onSongStart(makeSong(20))
    expect(scrobbleFn).not.toHaveBeenCalled()
  })

  test('曲開始時に submission=false を即時送信する', async () => {
    service.onSongStart(makeSong(300))
    expect(scrobbleFn).toHaveBeenCalledTimes(1)
    expect(scrobbleFn).toHaveBeenCalledWith('song-1', { submission: false })
  })

  test('スキップ時はタイマーをキャンセルして completion を送らない', () => {
    const clock = lolex.install()
    try {
      service.onSongStart(makeSong(300))
      service.onSongSkip()
      clock.tick(200_000)
      // submission=false（Now Playing）の1回のみ
      expect(scrobbleFn).toHaveBeenCalledTimes(1)
    } finally {
      clock.uninstall()
    }
  })

  test('新曲開始で前の曲のタイマーをキャンセルする', () => {
    const clock = lolex.install()
    try {
      service.onSongStart(makeSong(300))
      service.onSongStart(makeSong(300))
      clock.tick(100_000)
      // 各曲の submission=false 2回のみ（完了スクロブルなし）
      expect(scrobbleFn).toHaveBeenCalledTimes(2)
      const calls = scrobbleFn.mock.calls
      expect(calls[0][1]).toEqual({ submission: false })
      expect(calls[1][1]).toEqual({ submission: false })
    } finally {
      clock.uninstall()
    }
  })

  test('閾値経過後に submission=true を送信する', () => {
    const clock = lolex.install()
    try {
      service.onSongStart(makeSong(300))
      // 300s曲の50% = 150s = 150000ms でタイマー起動
      clock.tick(150_000)
      expect(scrobbleFn).toHaveBeenCalledTimes(2)
      const completionCall = scrobbleFn.mock.calls[1]
      expect(completionCall[0]).toBe('song-1')
      expect(completionCall[1].submission).toBe(true)
      expect(typeof completionCall[1].time).toBe('number')
    } finally {
      clock.uninstall()
    }
  })

  test('submitOnComplete=false なら閾値経過しても submission=true を送らない', () => {
    const clock = lolex.install()
    try {
      const fn = mock(() => Promise.resolve())
      const svc = new ScrobbleService(fn as any, { submitOnComplete: false })
      svc.onSongStart(makeSong(300))
      clock.tick(200_000)
      expect(fn).toHaveBeenCalledTimes(1) // Now Playing のみ
      expect(fn).toHaveBeenCalledWith('song-1', { submission: false })
    } finally {
      clock.uninstall()
    }
  })
})
