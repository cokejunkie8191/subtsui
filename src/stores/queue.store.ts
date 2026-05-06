// src/stores/queue.store.ts
import { create } from 'zustand'
import type { Song } from '../types/subsonic'

type QueueState = {
  items: Song[]
  currentIndex: number
  enqueueLast: (song: Song) => void
  enqueueNext: (song: Song) => void
  remove: (index: number) => void
  clear: () => void
  moveUp: (index: number) => void
  moveDown: (index: number) => void
  next: () => Song | null
  prev: () => Song | null
  setCurrentIndex: (index: number) => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  currentIndex: -1,

  enqueueLast: (song) => set(s => ({ items: [...s.items, song] })),

  enqueueNext: (song) => set(s => {
    const idx = s.currentIndex
    const items = [...s.items]
    items.splice(idx + 1, 0, song)
    return { items }
  }),

  remove: (index) => set(s => {
    const items = s.items.filter((_, i) => i !== index)
    const currentIndex = index < s.currentIndex
      ? s.currentIndex - 1
      : index === s.currentIndex ? -1 : s.currentIndex
    return { items, currentIndex }
  }),

  clear: () => set({ items: [], currentIndex: -1 }),

  moveUp: (index) => set(s => {
    if (index <= 0) return s
    const items = [...s.items]
    ;[items[index - 1], items[index]] = [items[index], items[index - 1]]
    return { items }
  }),

  moveDown: (index) => set(s => {
    if (index >= s.items.length - 1) return s
    const items = [...s.items]
    ;[items[index], items[index + 1]] = [items[index + 1], items[index]]
    return { items }
  }),

  next: () => {
    const { items, currentIndex } = get()
    const nextIdx = currentIndex + 1
    if (nextIdx >= items.length) return null
    set({ currentIndex: nextIdx })
    return items[nextIdx]
  },

  prev: () => {
    const { items, currentIndex } = get()
    const prevIdx = currentIndex - 1
    if (prevIdx < 0) return null
    set({ currentIndex: prevIdx })
    return items[prevIdx]
  },

  setCurrentIndex: (index) => set({ currentIndex: index }),
}))
