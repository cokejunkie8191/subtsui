// src/screens/SearchScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import TextInput from 'ink-text-input'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useServices, triggerPlay } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import { isEnter } from '../framework/keys'
import type { SearchResult } from '../types/subsonic'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'
import { makeArtistDetailScreen } from './ArtistDetailScreen'

type Mode = 'input' | 'results'
type Filter = 'songs' | 'albums' | 'artists'

type State = {
  query: string
  mode: Mode
  filter: Filter
  cursor: number
  isLoading: boolean
  results: SearchResult
  set: (s: Partial<Omit<State, 'set'>>) => void
}

const useSearchStore = create<State>((set) => ({
  query: '',
  mode: 'input',
  filter: 'songs',
  cursor: 0,
  isLoading: false,
  results: { songs: [], albums: [], artists: [] },
  set: (s) => set(s),
}))

const FILTERS: Filter[] = ['songs', 'albums', 'artists']

function SearchView() {
  const { subsonic, config } = useServices()
  const query = useSearchStore(s => s.query)
  const mode = useSearchStore(s => s.mode)
  const filter = useSearchStore(s => s.filter)
  const cursor = useSearchStore(s => s.cursor)
  const isLoading = useSearchStore(s => s.isLoading)
  const results = useSearchStore(s => s.results)
  const setSearch = useSearchStore(s => s.set)
  const activeTab = useNavStore(s => s.activeTab)
  const setNavInput = useNavStore.getState().setTextInputFocused
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 10)

  useEffect(() => {
    setNavInput(mode === 'input')
    return () => setNavInput(false)
  }, [mode])

  useEffect(() => {
    if (activeTab === 'search') {
      useSearchStore.getState().set({ mode: 'input', cursor: 0 })
    }
  }, [activeTab])

  useEffect(() => {
    if (!query.trim()) {
      setSearch({ results: { songs: [], albums: [], artists: [] } })
      return
    }
    const timer = setTimeout(async () => {
      setSearch({ isLoading: true })
      const r = await safeLoad(() => subsonic.search(query), 'Search failed')
      if (r) setSearch({ results: r, cursor: 0, isLoading: false })
      else   setSearch({ isLoading: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const list = results[filter]

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={mode === 'input' ? config.theme.highlight : config.theme.subtle}>/ </Text>
        {mode === 'input' ? (
          <TextInput
            value={query}
            onChange={(v) => setSearch({ query: v })}
            onSubmit={() => {
              if (list.length > 0) setSearch({ mode: 'results', cursor: 0 })
            }}
            placeholder="Search..."
            focus={true}
          />
        ) : (
          <Text color={config.theme.subtle}>{query}</Text>
        )}
      </Box>

      <Box>
        {FILTERS.map((f) => {
          const isActive = f === filter
          return (
            <Box key={f} marginRight={2}>
              <Text color={isActive ? config.theme.highlight : config.theme.subtle} underline={isActive}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({results[f].length})
              </Text>
            </Box>
          )
        })}
      </Box>

      {isLoading && <Text color={config.theme.subtle}>Searching...</Text>}

      {mode === 'results' && (
        <WindowList
          items={list as any[]}
          cursor={cursor}
          height={winHeight}
          renderItem={(item, _i, isCursor) => {
            if (filter === 'songs') {
              return <SongRow song={item} isCursor={isCursor} isPlaying={false} showAlbum
                              highlight={config.theme.highlight} subtle={config.theme.subtle} />
            }
            if (filter === 'albums') {
              return <AlbumRow album={item} isCursor={isCursor}
                              highlight={config.theme.highlight} subtle={config.theme.subtle} />
            }
            return (
              <Text color={isCursor ? config.theme.highlight : config.theme.subtle} inverse={isCursor}>
                {isCursor ? '▶ ' : '  '}{(item as any).name}  ·  {(item as any).albumCount} albums
              </Text>
            )
          }}
        />
      )}

      {mode === 'results' && (
        <Text color={config.theme.subtle} dimColor>
          j/k: move · Enter: open · Tab: filter · /: input · Esc: input
        </Text>
      )}
    </Box>
  )
}

export function makeSearchScreen(): Screen {
  return {
    id: 'search',
    title: 'Search',
    render: () => <SearchView />,
    onKey: (e: KeyEvent) => {
      const st = useSearchStore.getState()

      if (st.mode === 'input') {
        if (e.key.escape) {
          const list = st.results[st.filter]
          if (list.length > 0) st.set({ mode: 'results' })
          return true
        }
        return false
      }

      const list = st.results[st.filter]
      const max = list.length - 1

      if (e.input === '/' || e.key.escape) {
        st.set({ mode: 'input' })
        return true
      }

      if (e.key.tab) {
        const idx = FILTERS.indexOf(st.filter)
        const nextIdx = (idx + (e.key.shift ? -1 + FILTERS.length : 1)) % FILTERS.length
        st.set({ filter: FILTERS[nextIdx]!, cursor: 0 })
        return true
      }

      if (e.input === 'j' || e.key.downArrow) { st.set({ cursor: Math.min(max, st.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { st.set({ cursor: Math.max(0,   st.cursor - 1) }); return true }

      if (isEnter(e)) {
        const item: any = list[st.cursor]
        if (!item) return true
        if (st.filter === 'songs') {
          triggerPlay(item)
          return true
        }
        if (st.filter === 'albums') {
          useNavStore.getState().push(makeAlbumDetailScreen(item.id, item.name))
          return true
        }
        if (st.filter === 'artists') {
          useNavStore.getState().push(makeArtistDetailScreen(item.id, item.name))
          return true
        }
      }

      return false
    },
  }
}
