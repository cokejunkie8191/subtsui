// src/stores/library.store.ts
import { create } from 'zustand'
import type { Album } from '../types/subsonic'

type LibraryState = {
  albums: Album[]
  albumsLoaded: boolean       // 一度でも fetch したか
  albumsHasMore: boolean       // 続きがあるか
  albumsOffset: number

  setAlbums: (a: Album[]) => void
  appendAlbums: (a: Album[]) => void
  setAlbumsHasMore: (v: boolean) => void
  setAlbumsOffset: (v: number) => void
  setAlbumsLoaded: (v: boolean) => void
  invalidate: () => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  albums: [],
  albumsLoaded: false,
  albumsHasMore: true,
  albumsOffset: 0,

  setAlbums: (a) => set({ albums: a }),
  appendAlbums: (a) => set((s) => ({ albums: [...s.albums, ...a] })),
  setAlbumsHasMore: (v) => set({ albumsHasMore: v }),
  setAlbumsOffset: (v) => set({ albumsOffset: v }),
  setAlbumsLoaded: (v) => set({ albumsLoaded: v }),

  invalidate: () => set({
    albums: [], albumsLoaded: false, albumsHasMore: true, albumsOffset: 0,
  }),
}))
