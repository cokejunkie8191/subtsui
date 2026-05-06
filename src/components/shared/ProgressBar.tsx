// src/components/shared/ProgressBar.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  position: number
  duration: number
  width: number
  color?: string
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ProgressBar({ position, duration, width, color = '#7dd3fc' }: Props) {
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0
  const filled = Math.floor(ratio * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return (
    <Box gap={1}>
      <Text color={color}>{bar}</Text>
      <Text color="#6b7280">{formatTime(position)}/{formatTime(duration)}</Text>
    </Box>
  )
}
