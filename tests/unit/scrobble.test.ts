// tests/unit/scrobble.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { ScrobbleService } from '../../src/services/scrobble'
import type { Song } from '../../src/types/subsonic'

const makeSong = (duration: number, id: string = 'song-1'): Song => ({
  id,
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

  test('30秒未満の曲はスクロブルリクエストを送らない', () => {
    service.onSongStart(makeSong(20))
    expect(scrobbleFn).not.toHaveBeenCalled()
  })

  test('曲開始時に submission=false を即時送信する', () => {
    service.onSongStart(makeSong(300))
    expect(scrobbleFn).toHaveBeenCalledTimes(1)
    expect(scrobbleFn).toHaveBeenCalledWith('song-1', { submission: false })
  })

  test('閾値（50%）に達したポジション更新で submission=true を送信する', () => {
    service.onSongStart(makeSong(300)) // 50% = 150s
    service.onPositionUpdate(149)
    expect(scrobbleFn).toHaveBeenCalledTimes(1) // まだ Now Playing のみ
    service.onPositionUpdate(150)
    expect(scrobbleFn).toHaveBeenCalledTimes(2)
    const completionCall = scrobbleFn.mock.calls[1] as any
    expect(completionCall[0]).toBe('song-1')
    expect(completionCall[1].submission).toBe(true)
    expect(typeof completionCall[1].time).toBe('number')
  })

  test('長尺の曲は最大 240秒で submission=true を送信する', () => {
    service.onSongStart(makeSong(1000)) // 50% = 500s だが上限 240s
    service.onPositionUpdate(239)
    expect(scrobbleFn).toHaveBeenCalledTimes(1)
    service.onPositionUpdate(240)
    expect(scrobbleFn).toHaveBeenCalledTimes(2)
  })

  test('閾値超過後の追加ポジション更新では二重送信しない', () => {
    service.onSongStart(makeSong(300))
    service.onPositionUpdate(150)
    expect(scrobbleFn).toHaveBeenCalledTimes(2)
    service.onPositionUpdate(200)
    service.onPositionUpdate(250)
    expect(scrobbleFn).toHaveBeenCalledTimes(2)
  })

  test('閾値以下の同じポジションを何度更新しても送らない（ポーズ想定）', () => {
    service.onSongStart(makeSong(300))
    for (let i = 0; i < 100; i++) service.onPositionUpdate(50)
    expect(scrobbleFn).toHaveBeenCalledTimes(1) // Now Playing のみ
  })

  test('スキップ後はポジション更新が来ても submission=true を送らない', () => {
    service.onSongStart(makeSong(300))
    service.onSongSkip()
    service.onPositionUpdate(150)
    service.onPositionUpdate(200)
    expect(scrobbleFn).toHaveBeenCalledTimes(1) // Now Playing のみ
  })

  test('新曲開始で前曲の completion を引き継がない', () => {
    service.onSongStart(makeSong(300, 'song-1'))
    service.onSongStart(makeSong(300, 'song-2'))
    service.onPositionUpdate(150)
    expect(scrobbleFn).toHaveBeenCalledTimes(3) // Now Playing x2 + completion (song-2)
    const completionCall = scrobbleFn.mock.calls[2] as any
    expect(completionCall[0]).toBe('song-2')
    expect(completionCall[1].submission).toBe(true)
  })

  test('submitOnComplete=false ではポジション更新があっても submission=true を送らない', () => {
    const fn = mock(() => Promise.resolve())
    const svc = new ScrobbleService(fn as any, { submitOnComplete: false })
    svc.onSongStart(makeSong(300))
    svc.onPositionUpdate(150)
    svc.onPositionUpdate(200)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('song-1', { submission: false })
  })
})
