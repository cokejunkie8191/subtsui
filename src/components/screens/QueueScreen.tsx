// src/components/screens/QueueScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useQueueStore } from '../../stores/queue.store'
import type { AppConfig } from '../../types/config'

type Props = { config: AppConfig }

export function QueueScreen({ config }: Props) {
  const { items, currentIndex } = useQueueStore()

  if (items.length === 0) {
    return <Text color={config.theme.subtle}>Queue is empty. Press q on a song to add it.</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color={config.theme.subtle} dimColor>
        {items.length} tracks · x = remove · X = clear · Ctrl+j/k = reorder
      </Text>
      {items.map((song, i) => {
        const isPlaying = i === currentIndex
        return (
          <Box key={`${song.id}-${i}`}>
            <Text color={isPlaying ? config.theme.highlight : config.theme.subtle}>
              {isPlaying ? '▶ ' : `${String(i + 1).padStart(2)}. `}
              {song.title} — {song.artist}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
