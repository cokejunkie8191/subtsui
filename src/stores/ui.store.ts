// src/stores/ui.store.ts
import { create } from 'zustand'

export type ActiveTab = 'library' | 'queue' | 'search' | 'settings'
export type SearchFilter = 'songs' | 'albums' | 'artists'

type UiState = {
  activeTab: ActiveTab
  showNowPlaying: boolean
  showHelp: boolean
  showPlaylists: boolean
  showLogin: boolean
  searchQuery: string
  searchFilter: SearchFilter
  statusMessage: string | null
  setTab: (t: ActiveTab) => void
  nextTab: () => void
  prevTab: () => void
  toggleNowPlaying: () => void
  toggleHelp: () => void
  setShowLogin: (v: boolean) => void
  setSearchQuery: (q: string) => void
  setSearchFilter: (f: SearchFilter) => void
  setStatusMessage: (msg: string | null) => void
}

const TAB_ORDER: ActiveTab[] = ['library', 'queue', 'search', 'settings']

export const useUiStore = create<UiState>((set, get) => ({
  activeTab: 'library',
  showNowPlaying: false,
  showHelp: false,
  showPlaylists: false,
  showLogin: false,
  searchQuery: '',
  searchFilter: 'songs',
  statusMessage: null,

  setTab: (t) => set({ activeTab: t }),

  nextTab: () => set(s => {
    const i = TAB_ORDER.indexOf(s.activeTab)
    return { activeTab: TAB_ORDER[(i + 1) % TAB_ORDER.length] }
  }),

  prevTab: () => set(s => {
    const i = TAB_ORDER.indexOf(s.activeTab)
    return { activeTab: TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length] }
  }),

  toggleNowPlaying: () => set(s => ({ showNowPlaying: !s.showNowPlaying })),
  toggleHelp: () => set(s => ({ showHelp: !s.showHelp })),
  setShowLogin: (v) => set({ showLogin: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchFilter: (f) => set({ searchFilter: f }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
}))
