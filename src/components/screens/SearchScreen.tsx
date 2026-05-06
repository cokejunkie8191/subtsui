// src/components/screens/SearchScreen.tsx
import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { SongTable } from '../shared/SongTable'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'
import type { SearchResult, Song } from '../../types/subsonic'

type Mode = 'input' | 'results'
type Filter = 'songs' | 'albums' | 'artists'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient
  onPlay: (song: Song) => void
}

export function SearchScreen({ config, subsonic, onPlay }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ songs: [], albums: [], artists: [] })
  const [filter, setFilter] = useState<Filter>('songs')
  const [cursor, setCursor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('input')

  const FILTERS: Filter[] = ['songs', 'albums', 'artists']

  useEffect(() => {
    if (!query.trim()) { setResults({ songs: [], albums: [], artists: [] }); return }
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setSearchError(null)
      try {
        const res = await subsonic.search(query)
        setResults(res)
        setCursor(0)
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // タブ切り替え時に input モードに戻す
  useEffect(() => { setMode('input') }, [])

  const currentList = results[filter]

  useInput((input, key) => {
    if (key.escape) { setMode('input'); return }
    if (input === '/' ) { setMode('input'); return }
    if (key.tab) {
      const next = FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]
      setFilter(next)
      setCursor(0)
      return
    }
    if (input === 'j' || key.downArrow) {
      setCursor(c => Math.min(currentList.length - 1, c + 1))
      return
    }
    if (input === 'k' || key.upArrow) {
      setCursor(c => Math.max(0, c - 1))
      return
    }
    if (key.return && filter === 'songs') {
      const song = results.songs[cursor]
      if (song) onPlay(song)
    }
  }, { isActive: mode === 'results' })

  function handleInputSubmit() {
    if (currentList.length > 0) {
      setCursor(0)
      setMode('results')
    }
  }

  const modeHint = mode === 'input'
    ? 'Enter: 結果へ移動'
    : 'j/k: 移動  Enter: 再生  Tab: フィルター切替  /: 検索に戻る'

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box gap={1} marginBottom={1}>
        <Text color={mode === 'input' ? config.theme.highlight : config.theme.subtle}>/</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={handleInputSubmit}
          placeholder="Search songs, albums, artists..."
          focus={mode === 'input'}
        />
      </Box>
      <Text color={config.theme.subtle} dimColor>{modeHint}</Text>
      {searchError && <Text color="#f87171">Error: {searchError}</Text>}
      <Box gap={2} marginY={1}>
        {FILTERS.map(f => (
          <Text
            key={f}
            color={f === filter ? config.theme.highlight : config.theme.subtle}
            underline={f === filter}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({results[f].length})
          </Text>
        ))}
      </Box>
      {isLoading ? (
        <Text color={config.theme.subtle}>Searching...</Text>
      ) : filter === 'songs' ? (
        <SongTable
          songs={results.songs}
          cursor={mode === 'results' ? cursor : -1}
          columns={config.columns.songs}
          highlight={config.theme.highlight}
          subtle={config.theme.subtle}
        />
      ) : filter === 'albums' ? (
        <Box flexDirection="column">
          {results.albums.map((a, i) => (
            <Text key={a.id} color={mode === 'results' && i === cursor ? config.theme.highlight : config.theme.subtle}>
              {mode === 'results' && i === cursor ? '▶ ' : '  '}{a.name} — {a.artist}
            </Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {results.artists.map((a, i) => (
            <Text key={a.id} color={mode === 'results' && i === cursor ? config.theme.highlight : config.theme.subtle}>
              {mode === 'results' && i === cursor ? '▶ ' : '  '}{a.name}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
