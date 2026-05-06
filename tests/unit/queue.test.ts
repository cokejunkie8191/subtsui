// tests/unit/queue.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { useQueueStore } from '../../src/stores/queue.store'
import type { Song } from '../../src/types/subsonic'

const makeSong = (id: string): Song => ({
  id, title: `Song ${id}`, artist: 'A', artistId: 'a',
  album: 'B', albumId: 'b', duration: 180, rating: 0,
})

describe('QueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ items: [], currentIndex: -1 })
  })

  test('enqueueLast で末尾に追加される', () => {
    useQueueStore.getState().enqueueLast(makeSong('1'))
    useQueueStore.getState().enqueueLast(makeSong('2'))
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '2'])
  })

  test('enqueueNext で currentIndex の直後に挿入される', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().enqueueNext(makeSong('2'))
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '2', '3'])
  })

  test('next() で currentIndex が進む', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2')], currentIndex: 0 })
    const song = useQueueStore.getState().next()
    expect(song?.id).toBe('2')
    expect(useQueueStore.getState().currentIndex).toBe(1)
  })

  test('clear() で items が空になり currentIndex が -1 になる', () => {
    useQueueStore.setState({ items: [makeSong('1')], currentIndex: 0 })
    useQueueStore.getState().clear()
    expect(useQueueStore.getState().items).toHaveLength(0)
    expect(useQueueStore.getState().currentIndex).toBe(-1)
  })

  test('remove() で指定インデックスの曲が削除される', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().remove(1)
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '3'])
  })

  test('moveUp() でアイテムを1つ上に移動する', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().moveUp(2)
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '3', '2'])
  })
})
