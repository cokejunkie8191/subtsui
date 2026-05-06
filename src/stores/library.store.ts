// src/stores/library.store.ts
import { create } from 'zustand'
import type { Song, Album, Artist, Playlist } from '../types/subsonic'

export type LibraryView = 'songs' | 'albums' | 'artists' | 'playlists' | 'starred'

type LibraryState = {
  view: LibraryView
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  playlists: Playlist[]
  cursor: number
  pageOffset: number
  isLoading: boolean
  hasMore: boolean
  setView: (v: LibraryView) => void
  setItems: (type: 'songs' | 'albums' | 'artists' | 'playlists', items: any[]) => void
  appendItems: (type: 'songs' | 'albums' | 'artists', items: any[]) => void
  setCursor: (c: number) => void
  moveCursor: (delta: number) => void
  setLoading: (v: boolean) => void
  setHasMore: (v: boolean) => void
  setPageOffset: (v: number) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  view: 'songs',
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
  cursor: 0,
  pageOffset: 0,
  isLoading: false,
  hasMore: false,

  setView: (v) => set({ view: v, cursor: 0, pageOffset: 0 }),

  setItems: (type, items) => set({ [type]: items, cursor: 0, pageOffset: 0 }),

  appendItems: (type, items) => set(s => ({ [type]: [...(s as any)[type], ...items] })),

  setCursor: (c) => set({ cursor: c }),

  moveCursor: (delta) => set(s => {
    const list = s.view === 'albums' ? s.albums
      : s.view === 'artists' ? s.artists
      : s.view === 'playlists' ? s.playlists
      : s.songs
    const max = list.length - 1
    return { cursor: Math.max(0, Math.min(max, s.cursor + delta)) }
  }),

  setLoading: (v) => set({ isLoading: v }),
  setHasMore: (v) => set({ hasMore: v }),
  setPageOffset: (v) => set({ pageOffset: v }),
}))
