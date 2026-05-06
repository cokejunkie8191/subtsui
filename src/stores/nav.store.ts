// src/stores/nav.store.ts
import { create } from 'zustand'
import type { Screen } from '../framework/Screen'

export type Tab = 'library' | 'queue' | 'search'

type NavState = {
  activeTab: Tab
  stacks: Record<Tab, Screen[]>
  modal: Screen | null
  textInputFocused: boolean

  setTab: (t: Tab) => void
  push: (s: Screen) => void
  pop: () => boolean
  replace: (s: Screen) => void
  replaceStack: (t: Tab, screens: Screen[]) => void
  openModal: (s: Screen) => void
  closeModal: () => void
  setTextInputFocused: (v: boolean) => void
}

export const useNavStore = create<NavState>((set, get) => ({
  activeTab: 'library',
  stacks: { library: [], queue: [], search: [] },
  modal: null,
  textInputFocused: false,

  setTab: (t) => set({ activeTab: t }),

  push: (s) => set((st) => {
    const tab = st.activeTab
    return { stacks: { ...st.stacks, [tab]: [...st.stacks[tab], s] } }
  }),

  pop: () => {
    const st = get()
    const tab = st.activeTab
    const stack = st.stacks[tab]
    if (stack.length <= 1) return false
    const top = stack[stack.length - 1]
    top?.onUnmount?.()
    set({ stacks: { ...st.stacks, [tab]: stack.slice(0, -1) } })
    return true
  },

  replace: (s) => set((st) => {
    const tab = st.activeTab
    const stack = st.stacks[tab]
    const newStack = stack.length === 0 ? [s] : [...stack.slice(0, -1), s]
    return { stacks: { ...st.stacks, [tab]: newStack } }
  }),

  replaceStack: (t, screens) => set((st) => ({
    stacks: { ...st.stacks, [t]: screens },
  })),

  openModal: (s) => set({ modal: s }),
  closeModal: () => {
    const m = get().modal
    m?.onUnmount?.()
    set({ modal: null })
  },

  setTextInputFocused: (v) => set({ textInputFocused: v }),
}))
