// tests/unit/search-screen.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { makeSearchScreen, useSearchStore } from '../../src/screens/SearchScreen'
import { useQueueStore } from '../../src/stores/queue.store'
import { setGlobalSubsonic } from '../../src/framework/ServiceContext'
import type { Song, Album } from '../../src/types/subsonic'
import type { KeyEvent } from '../../src/framework/Screen'

const key = (input: string): KeyEvent => ({ input, key: {} })

const song1: Song = { id: 's1', title: 'Song 1', artist: 'Artist', album: 'Album', albumId: 'a1', duration: 200, track: 1 }
const song2: Song = { id: 's2', title: 'Song 2', artist: 'Artist', album: 'Album', albumId: 'a1', duration: 180, track: 2 }
const album1: Album = { id: 'a1', name: 'Album 1', artist: 'Artist', songCount: 2, duration: 380 }

beforeEach(() => {
  useQueueStore.getState().clear()
  useSearchStore.getState().set({
    mode: 'results',
    filter: 'songs',
    cursor: 0,
    results: { songs: [song1, song2], albums: [album1], artists: [] },
  })
})

afterEach(() => {
  setGlobalSubsonic(null)
  useQueueStore.getState().clear()
})

describe('SearchScreen onKey — songs フィルター', () => {
  test('q でカーソル曲をキューに追加する', () => {
    const screen = makeSearchScreen()
    screen.onKey!(key('q'))
    expect(useQueueStore.getState().items).toHaveLength(1)
    expect(useQueueStore.getState().items[0]?.id).toBe('s1')
  })

  test('q を押しても results モードから外れない', () => {
    const screen = makeSearchScreen()
    const result = screen.onKey!(key('q'))
    expect(result).toBe(true)
    expect(useSearchStore.getState().mode).toBe('results')
  })
})

describe('SearchScreen onKey — albums フィルター', () => {
  test('Q でアルバム全曲をキューに追加する', async () => {
    const fakeSubsonic = {
      getAlbum: async (_id: string) => ({ album: album1, songs: [song1, song2] }),
    } as any
    setGlobalSubsonic(fakeSubsonic)

    useSearchStore.getState().set({ filter: 'albums', cursor: 0 })

    const screen = makeSearchScreen()
    screen.onKey!(key('Q'))

    await new Promise(r => setTimeout(r, 50))

    expect(useQueueStore.getState().items).toHaveLength(2)
    expect(useQueueStore.getState().items[0]?.id).toBe('s1')
    expect(useQueueStore.getState().items[1]?.id).toBe('s2')
  })
})
