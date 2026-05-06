// src/components/layout/NowPlayingOverlay.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { AlbumArt } from '../shared/AlbumArt'
import { ProgressBar } from '../shared/ProgressBar'
import { usePlayerStore } from '../../stores/player.store'
import type { SubsonicClient } from '../../services/subsonic'
import type { StructuredLyrics } from '../../types/subsonic'
import type { AppConfig } from '../../types/config'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient | null
}

export function NowPlayingOverlay({ config, subsonic }: Props) {
  const { currentSong, position, duration, status } = usePlayerStore()
  const [lyrics, setLyrics] = useState<StructuredLyrics | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80

  useEffect(() => {
    if (!currentSong || !subsonic) { setLyrics(null); return }
    subsonic.getLyrics(currentSong.id).then(setLyrics).catch(() => setLyrics(null))
  }, [currentSong?.id])

  const coverArtUrl = currentSong && subsonic
    ? subsonic.coverArtUrl(currentSong.albumId, 300)
    : null

  const artSize = Math.min(Math.floor(termWidth * 0.3), 300)

  const currentLine = lyrics?.synced
    ? [...(lyrics.lines ?? [])].reverse().find(l => l.start / 1000 <= position)?.value
    : null

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={config.theme.highlight}
      padding={1}
    >
      <Text color={config.theme.highlight} bold> Now Playing</Text>
      <Box gap={2} marginTop={1}>
        <AlbumArt coverArtUrl={coverArtUrl} pixelSize={artSize} />
        <Box flexDirection="column" flexGrow={1} gap={1}>
          <Text color="#ffffff" bold>{currentSong?.title ?? '—'}</Text>
          <Text color={config.theme.subtle}>{currentSong?.artist}</Text>
          <Text color={config.theme.subtle}>{currentSong?.album}{currentSong?.year ? ` (${currentSong.year})` : ''}</Text>
          <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
          <Text color={config.theme.subtle}>
            {'★'.repeat(currentSong?.rating ?? 0)}{'☆'.repeat(5 - (currentSong?.rating ?? 0))}
            {currentSong?.starred ? '  ♥' : ''}
          </Text>
          {currentLine && (
            <Box marginTop={1} borderStyle="single" borderColor={config.theme.subtle} padding={1}>
              <Text color={config.theme.highlight} italic>{currentLine}</Text>
            </Box>
          )}
          {lyrics && !lyrics.synced && (
            <Box marginTop={1} flexDirection="column">
              {lyrics.lines.slice(0, 10).map((l, i) => (
                <Text key={i} color={config.theme.subtle}>{l.value}</Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <Text color={config.theme.subtle} dimColor> Press M to close</Text>
    </Box>
  )
}
