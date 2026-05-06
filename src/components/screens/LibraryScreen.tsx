// src/components/screens/LibraryScreen.tsx
import React, { useEffect, useRef, useState } from 'react'
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
const ALBUM_PAGE = 50
const CONCURRENCY = 5

export function LibraryScreen({ config, subsonic, mpv, scrobble }: Props) {
  const { view, songs, albums, artists, cursor, isLoading, setItems, appendItems, setLoading, setHasMore } = useLibraryStore()
  const { enqueueLast, setCurrentIndex } = useQueueStore()
  const { setCurrentSong } = usePlayerStore()
  const [loadError, setLoadError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    setLoadError(null)
    if (view === 'songs' && songs.length === 0) loadSongsByAlbums()
    if (view === 'albums' && albums.length === 0) loadAlbums(0)
    if (view === 'artists' && artists.length === 0) loadArtists()
    if (view === 'starred') loadStarred()
    return () => { cancelRef.current = true }
  }, [view])

  // All Songs: アルバム一覧 → 各アルバムの曲を並列ストリーミング
  async function loadSongsByAlbums() {
    setLoading(true)
    let albumOffset = 0
    try {
      while (!cancelRef.current) {
        const albumBatch = await subsonic.getAlbumList('alphabeticalByName', { size: ALBUM_PAGE, offset: albumOffset })
        if (albumBatch.length === 0 || cancelRef.current) break

        for (let i = 0; i < albumBatch.length; i += CONCURRENCY) {
          if (cancelRef.current) break
          const chunk = albumBatch.slice(i, i + CONCURRENCY)
          const results = await Promise.all(chunk.map(a => subsonic.getAlbum(a.id)))
          if (!cancelRef.current) appendItems('songs', results.flatMap(r => r.songs))
        }

        albumOffset += albumBatch.length
        if (albumBatch.length < ALBUM_PAGE) break
      }
      if (!cancelRef.current) setHasMore(false)
    } catch (e) {
      if (!cancelRef.current) setLoadError(e instanceof Error ? e.message : 'Failed to load songs')
    } finally {
      if (!cancelRef.current) setLoading(false)
    }
  }

  async function loadAlbums(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.getAlbumList('newest', { size: 150, offset })
      if (offset === 0) setItems('albums', result)
      else appendItems('albums', result)
      setHasMore(result.length === 150)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load albums')
    } finally {
      setLoading(false)
    }
  }

  // Artists: getArtists エンドポイント（全文検索不要で高速）
  async function loadArtists() {
    setLoading(true)
    try {
      const result = await subsonic.getArtists()
      setItems('artists', result)
      setHasMore(false)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load artists')
    } finally {
      setLoading(false)
    }
  }

  async function loadStarred() {
    setLoading(true)
    try {
      const result = await subsonic.getStarred()
      setItems('songs', result.songs)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load starred')
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
    songs.slice(index + 1).forEach(s => enqueueLast(s))
    setCurrentIndex(0)
  }

  const currentItems = view === 'albums' ? albums
    : view === 'artists' ? artists
    : songs

  return (
    <Box flexDirection="column" flexGrow={1}>
      {loadError && <Text color="#f87171">Error: {loadError}</Text>}
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
        <Box flexDirection="column" flexGrow={1}>
          <SongTable
            songs={songs}
            cursor={cursor}
            columns={config.columns.songs}
            highlight={config.theme.highlight}
            subtle={config.theme.subtle}
          />
          {isLoading && (
            <Text color={config.theme.subtle} dimColor>
              {songs.length} songs loaded, streaming more...
            </Text>
          )}
        </Box>
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
