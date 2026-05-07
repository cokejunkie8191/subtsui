// src/screens/AlbumDetailScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useQueueStore } from '../stores/queue.store'
import { usePlayerStore } from '../stores/player.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import { safeLoad } from '../framework/safeLoad'
import { triggerPlay } from '../framework/ServiceContext'
import type { Screen, KeyEvent } from '../framework/Screen'
import { isEnter } from '../framework/keys'
import type { Song, Album } from '../types/subsonic'

type DetailState = {
  cursor: number
  album: Album | null
  songs: Song[]
  isLoading: boolean
  set: (s: Partial<Omit<DetailState, 'set'>>) => void
}

function makeStore() {
  return create<DetailState>((set) => ({
    cursor: 0,
    album: null,
    songs: [],
    isLoading: false,
    set: (s) => set(s),
  }))
}

function AlbumDetailView({ store, albumId }: { store: ReturnType<typeof makeStore>; albumId: string }) {
  const { subsonic, config } = useServices()
  const cursor = store(s => s.cursor)
  const album = store(s => s.album)
  const songs = store(s => s.songs)
  const isLoading = store(s => s.isLoading)
  const set = store(s => s.set)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 10)

  useEffect(() => {
    set({ isLoading: true })
    safeLoad(() => subsonic.getAlbum(albumId), 'Failed to load album')
      .then(r => {
        if (r) set({ album: r.album, songs: r.songs, isLoading: false })
        else set({ isLoading: false })
      })
  }, [albumId])

  if (isLoading || !album) {
    return <Text color={config.theme.subtle}>Loading...</Text>
  }

  const total = songs.reduce((acc, s) => acc + s.duration, 0)
  const totalMin = Math.floor(total / 60)
  const totalSec = total % 60

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={config.theme.highlight} bold>{album.name}</Text>
        <Text color={config.theme.subtle}>  ─  {album.artist}  ─  {album.year ?? '----'}</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={config.theme.subtle} dimColor>Esc/h: back</Text>
        </Box>
      </Box>
      <WindowList
        items={songs}
        cursor={cursor}
        height={winHeight}
        renderItem={(song, _i, isCursor) => (
          <SongRow song={song} isCursor={isCursor} isPlaying={false} showAlbum={false}
                   highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
      <Text color={config.theme.subtle}>
        {songs.length} tracks  ·  {totalMin}:{totalSec.toString().padStart(2,'0')}
      </Text>
    </Box>
  )
}

export function makeAlbumDetailScreen(albumId: string, fallbackTitle: string = 'Album'): Screen {
  const store = makeStore()

  return {
    id: `album-detail:${albumId}`,
    title: fallbackTitle,
    render: () => <AlbumDetailView store={store} albumId={albumId} />,
    onKey: (e: KeyEvent) => {
      const s = store.getState()
      const max = s.songs.length - 1

      if (e.input === 'j' || e.key.downArrow) { s.set({ cursor: Math.min(max, s.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { s.set({ cursor: Math.max(0,   s.cursor - 1) }); return true }
      if (e.input === 'g')                    { s.set({ cursor: 0 });   return true }
      if (e.input === 'G')                    { s.set({ cursor: max }); return true }

      if (isEnter(e)) {
        const song = s.songs[s.cursor]
        if (song) {
          const queue = useQueueStore.getState()
          queue.clear()
          s.songs.forEach(x => queue.enqueueLast(x))
          queue.jumpTo(s.cursor)
          triggerPlay(song)
        }
        return true
      }
      if (e.input === 'q') {
        const song = s.songs[s.cursor]
        if (song) useQueueStore.getState().enqueueLast(song)
        return true
      }
      if (e.input === 'Q') {
        s.songs.forEach(song => useQueueStore.getState().enqueueLast(song))
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
