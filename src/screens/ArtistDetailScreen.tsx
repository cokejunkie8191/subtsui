// src/screens/ArtistDetailScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import { isEnter } from '../framework/keys'
import type { Album, Artist } from '../types/subsonic'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'

type State = {
  cursor: number
  artist: Artist | null
  albums: Album[]
  isLoading: boolean
  set: (s: Partial<Omit<State, 'set'>>) => void
}

function makeStore() {
  return create<State>((set) => ({
    cursor: 0, artist: null, albums: [], isLoading: false,
    set: (s) => set(s),
  }))
}

function ArtistDetailView({ store, artistId }: { store: ReturnType<typeof makeStore>; artistId: string }) {
  const { subsonic, config } = useServices()
  const cursor = store(s => s.cursor)
  const artist = store(s => s.artist)
  const albums = store(s => s.albums)
  const isLoading = store(s => s.isLoading)
  const set = store(s => s.set)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  useEffect(() => {
    set({ isLoading: true })
    safeLoad(() => subsonic.getArtist(artistId), 'Failed to load artist')
      .then(r => {
        if (r) set({ artist: r.artist, albums: r.albums, isLoading: false })
        else set({ isLoading: false })
      })
  }, [artistId])

  if (isLoading || !artist) {
    return <Text color={config.theme.subtle}>Loading...</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={config.theme.highlight} bold>{artist.name}</Text>
        <Text color={config.theme.subtle}>  ·  {albums.length} albums</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={config.theme.subtle} dimColor>Esc/h: back</Text>
        </Box>
      </Box>
      <WindowList
        items={albums}
        cursor={cursor}
        height={winHeight}
        renderItem={(album, _i, isCursor) => (
          <AlbumRow album={album} isCursor={isCursor}
                    highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeArtistDetailScreen(artistId: string, fallbackTitle: string = 'Artist'): Screen {
  const store = makeStore()
  return {
    id: `artist-detail:${artistId}`,
    title: fallbackTitle,
    render: () => <ArtistDetailView store={store} artistId={artistId} />,
    onKey: (e: KeyEvent) => {
      const s = store.getState()
      const max = s.albums.length - 1
      if (e.input === 'j' || e.key.downArrow) { s.set({ cursor: Math.min(max, s.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { s.set({ cursor: Math.max(0,   s.cursor - 1) }); return true }
      if (e.input === 'g')                    { s.set({ cursor: 0 });   return true }
      if (e.input === 'G')                    { s.set({ cursor: max }); return true }
      if (isEnter(e)) {
        const album = s.albums[s.cursor]
        if (album) useNavStore.getState().push(makeAlbumDetailScreen(album.id, album.name))
        return true
      }
      if (e.key.escape || e.input === 'h') {
        useNavStore.getState().pop()
        return true
      }
      return false
    },
  }
}
