// src/components/screens/LibraryScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { SongTable } from '../shared/SongTable'
import { useLibraryStore, type LibraryView } from '../../stores/library.store'
import { useQueueStore } from '../../stores/queue.store'
import { usePlayerStore } from '../../stores/player.store'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'
import type { MpvClient } from '../../services/mpv'
import type { ScrobbleService } from '../../services/scrobble'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient
  mpv: MpvClient
  scrobble: ScrobbleService
}

const VIEW_LABELS: Record<LibraryView, string> = {
  songs: 'All Songs',
  albums: 'Albums',
  artists: 'Artists',
  playlists: 'Playlists',
  starred: 'Starred ★',
}

const VIEWS: LibraryView[] = ['songs', 'albums', 'artists', 'playlists', 'starred']

export function LibraryScreen({ config, subsonic, mpv, scrobble }: Props) {
  const { view, songs, albums, artists, cursor, isLoading, hasMore, setView, setItems, appendItems, setLoading, setHasMore, setPageOffset, pageOffset } = useLibraryStore()
  const { enqueueLast, setCurrentIndex } = useQueueStore()
  const { setCurrentSong } = usePlayerStore()

  useEffect(() => {
    if (view === 'songs' && songs.length === 0) loadSongs(0)
    if (view === 'albums' && albums.length === 0) loadAlbums(0)
    if (view === 'artists' && artists.length === 0) loadArtists(0)
    if (view === 'starred') loadStarred()
  }, [view])

  async function loadSongs(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.search('', { songCount: 150, albumCount: 0, artistCount: 0, offset })
      if (offset === 0) setItems('songs', result.songs)
      else appendItems('songs', result.songs)
      setHasMore(result.songs.length === 150)
      setPageOffset(offset + result.songs.length)
    } finally {
      setLoading(false)
    }
  }

  async function loadAlbums(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.getAlbumList('newest', { offset })
      if (offset === 0) setItems('albums', result)
      else appendItems('albums', result)
      setHasMore(result.length === 150)
    } finally {
      setLoading(false)
    }
  }

  async function loadArtists(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.search('', { songCount: 0, albumCount: 0, artistCount: 150, offset })
      if (offset === 0) setItems('artists', result.artists)
      else appendItems('artists', result.artists)
      setHasMore(result.artists.length === 150)
    } finally {
      setLoading(false)
    }
  }

  async function loadStarred() {
    setLoading(true)
    try {
      const result = await subsonic.getStarred()
      setItems('songs', result.songs)
    } finally {
      setLoading(false)
    }
  }

  async function playSong(index: number) {
    const song = songs[index]
    if (!song) return
    const url = subsonic.streamUrl(song.id)
    await mpv.loadFile(url)
    setCurrentSong(song)
    scrobble.onSongStart(song)
    const remaining = songs.slice(index + 1)
    remaining.forEach(s => enqueueLast(s))
    setCurrentIndex(0)
  }

  const currentItems = view === 'albums' ? albums
    : view === 'artists' ? artists
    : songs

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box gap={2} marginBottom={1}>
        {VIEWS.map(v => (
          <Text
            key={v}
            color={v === view ? config.theme.highlight : config.theme.subtle}
            underline={v === view}
          >
            {VIEW_LABELS[v]}
          </Text>
        ))}
      </Box>

      {isLoading && currentItems.length === 0 ? (
        <Text color={config.theme.subtle}>Loading...</Text>
      ) : view === 'songs' || view === 'starred' ? (
        <SongTable
          songs={songs}
          cursor={cursor}
          columns={config.columns.songs}
          highlight={config.theme.highlight}
          subtle={config.theme.subtle}
        />
      ) : view === 'albums' ? (
        <Box flexDirection="column">
          {albums.map((a, i) => (
            <Box key={a.id}>
              <Text color={i === cursor ? config.theme.highlight : config.theme.subtle}>
                {i === cursor ? '▶ ' : '  '}{a.name} — {a.artist} ({a.year ?? '?'})
              </Text>
            </Box>
          ))}
        </Box>
      ) : view === 'artists' ? (
        <Box flexDirection="column">
          {artists.map((a, i) => (
            <Box key={a.id}>
              <Text color={i === cursor ? config.theme.highlight : config.theme.subtle}>
                {i === cursor ? '▶ ' : '  '}{a.name} ({a.albumCount} albums)
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
