// src/screens/AlbumsScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useLibraryStore } from '../stores/library.store'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'

const PAGE = 150

const useAlbumsCursor = create<{ cursor: number; set: (n: number) => void }>((set) => ({
  cursor: 0,
  set: (n) => set({ cursor: n }),
}))

function AlbumsView() {
  const { subsonic, config } = useServices()
  const albums = useLibraryStore(s => s.albums)
  const hasMore = useLibraryStore(s => s.albumsHasMore)
  const offset = useLibraryStore(s => s.albumsOffset)
  const loaded = useLibraryStore(s => s.albumsLoaded)
  const cursor = useAlbumsCursor(s => s.cursor)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  useEffect(() => {
    if (!loaded) loadMore()
  }, [])

  useEffect(() => {
    if (hasMore && cursor >= albums.length - 30 && albums.length > 0) {
      loadMore()
    }
  }, [cursor, albums.length, hasMore])

  async function loadMore() {
    const result = await safeLoad(
      () => subsonic.getAlbumList('newest', { size: PAGE, offset }),
      'Failed to load albums'
    )
    if (result) {
      const lib = useLibraryStore.getState()
      if (offset === 0) lib.setAlbums(result)
      else lib.appendAlbums(result)
      lib.setAlbumsOffset(offset + result.length)
      lib.setAlbumsHasMore(result.length === PAGE)
      lib.setAlbumsLoaded(true)
    }
  }

  if (!loaded && albums.length === 0) {
    return <Text color={config.theme.subtle}>Loading albums...</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color={config.theme.highlight} bold>
        Albums (newest)  {albums.length}{hasMore ? '+' : ''}
      </Text>
      <WindowList
        items={albums}
        cursor={cursor}
        height={winHeight}
        renderItem={(album, _i, isCursor) => (
          <AlbumRow album={album} isCursor={isCursor} highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeAlbumsScreen(): Screen {
  return {
    id: 'albums',
    title: 'Albums',
    render: () => <AlbumsView />,
    onKey: (e: KeyEvent) => {
      const albums = useLibraryStore.getState().albums
      const max = albums.length - 1
      const c = useAlbumsCursor.getState().cursor
      const set = useAlbumsCursor.getState().set

      if (e.input === 'j' || e.key.downArrow) { set(Math.min(max, c + 1)); return true }
      if (e.input === 'k' || e.key.upArrow)   { set(Math.max(0,   c - 1)); return true }
      if (e.input === 'g')                    { set(0);             return true }
      if (e.input === 'G')                    { set(max);           return true }
      if (e.key.return) {
        const album = albums[c]
        if (album) useNavStore.getState().push(makeAlbumDetailScreen(album.id, album.name))
        return true
      }
      if (e.key.escape || e.input === 'h') return true
      return false
    },
  }
}
