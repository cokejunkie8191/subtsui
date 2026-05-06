// src/components/layout/PlayerBar.tsx
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { ProgressBar } from '../shared/ProgressBar'
import { AlbumArt } from '../shared/AlbumArt'
import { usePlayerStore } from '../../stores/player.store'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient | null
}

function loopIcon(mode: string) {
  if (mode === 'all') return '🔁'
  if (mode === 'one') return '🔂'
  return '  '
}

export function PlayerBar({ config, subsonic }: Props) {
  const { status, currentSong, position, duration, volume, loopMode } = usePlayerStore()
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80
  const barWidth = Math.max(10, termWidth - 60)

  const coverArtUrl = currentSong && subsonic
    ? subsonic.coverArtUrl(currentSong.albumId, 32)
    : null

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor="#334155"
      paddingX={1}
      gap={1}
    >
      <AlbumArt coverArtUrl={coverArtUrl} pixelSize={32} />
      <Text color={status === 'playing' ? config.theme.highlight : config.theme.subtle}>
        {status === 'playing' ? '▶' : status === 'paused' ? '⏸' : '⏹'}
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text color={config.theme.highlight}>
          {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'No track'}
        </Text>
        <Box gap={1}>
          <ProgressBar position={position} duration={duration} width={barWidth} color={config.theme.highlight} />
          <Text color={config.theme.subtle}>{loopIcon(loopMode)} 🔊{Math.round(volume)}</Text>
        </Box>
      </Box>
    </Box>
  )
}
