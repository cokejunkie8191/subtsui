// src/components/StatusLine.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useStatusStore } from '../stores/status.store'

const ICONS = { info: 'ℹ', warn: '⚠', error: '✖' } as const
const COLORS = { info: '#9ca3af', warn: '#fbbf24', error: '#f87171' } as const

export function StatusLine() {
  const message = useStatusStore(s => s.message)
  const level = useStatusStore(s => s.level)

  if (!message || !level) return null

  return (
    <Box paddingX={1}>
      <Text color={COLORS[level]}>{ICONS[level]} {message}</Text>
    </Box>
  )
}
