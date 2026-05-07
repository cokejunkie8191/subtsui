// src/components/PlayerBar.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { ProgressBar } from './ProgressBar'
import { usePlayerStore } from '../stores/player.store'
import { useServices } from '../framework/ServiceContext'

function loopIcon(mode: string): string {
  if (mode === 'all') return '🔁'
  if (mode === 'one') return '🔂'
  return '  '
}

function statusIcon(status: string): string {
  if (status === 'playing') return '▶'
  if (status === 'paused') return '⏸'
  return '⏹'
}

export function PlayerBar() {
  const { config } = useServices()
  const status = usePlayerStore(s => s.status)
  const currentSong = usePlayerStore(s => s.currentSong)
  const position = usePlayerStore(s => s.position)
  const duration = usePlayerStore(s => s.duration)
  const volume = usePlayerStore(s => s.volume)
  const loopMode = usePlayerStore(s => s.loopMode)

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="#334155">
      <Box>
        <Text color={config.theme.subtle}>{statusIcon(status)} </Text>
        <Text color={config.theme.highlight} bold>
          {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'No track'}
        </Text>
      </Box>
      <Box>
        <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
        <Text color={config.theme.subtle}>  {loopIcon(loopMode)}  🔊{Math.round(volume)}</Text>
      </Box>
    </Box>
  )
}
