// src/components/screens/SearchScreen.tsx
import React, { useState, useEffect } from 'react'
import { Box, Text, TextInput } from 'ink'
import { SongTable } from '../shared/SongTable'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'
import type { SearchResult } from '../../types/subsonic'

type Props = { config: AppConfig; subsonic: SubsonicClient }

export function SearchScreen({ config, subsonic }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ songs: [], albums: [], artists: [] })
  const [filter, setFilter] = useState<'songs' | 'albums' | 'artists'>('songs')
  const [cursor, setCursor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults({ songs: [], albums: [], artists: [] }); return }
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await subsonic.search(query)
        setResults(res)
        setCursor(0)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box gap={1} marginBottom={1}>
        <Text color={config.theme.subtle}>/</Text>
        <TextInput value={query} onChange={setQuery} placeholder="Search songs, albums, artists..." />
      </Box>
      <Box gap={2} marginBottom={1}>
        {(['songs', 'albums', 'artists'] as const).map(f => (
          <Text
            key={f}
            color={f === filter ? config.theme.highlight : config.theme.subtle}
            underline={f === filter}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}({results[f].length})
          </Text>
        ))}
      </Box>
      {isLoading ? (
        <Text color={config.theme.subtle}>Searching...</Text>
      ) : filter === 'songs' ? (
        <SongTable
          songs={results.songs}
          cursor={cursor}
          columns={config.columns.songs}
          highlight={config.theme.highlight}
          subtle={config.theme.subtle}
        />
      ) : filter === 'albums' ? (
        <Box flexDirection="column">
          {results.albums.map((a, i) => (
            <Text key={a.id} color={i === cursor ? config.theme.highlight : config.theme.subtle}>
              {a.name} — {a.artist}
            </Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {results.artists.map((a, i) => (
            <Text key={a.id} color={i === cursor ? config.theme.highlight : config.theme.subtle}>
              {a.name}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
