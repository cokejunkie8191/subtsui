// src/components/ProgressBar.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  position: number   // sec
  duration: number
  width?: number     // 文字数（デフォルト 30）
  color?: string
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ProgressBar({ position, duration, width = 30, color = '#7dd3fc' }: Props) {
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0
  const filled = Math.floor(ratio * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return (
    <Box>
      <Text color={color}>{bar}</Text>
      <Text color="#6b7280">  {fmtTime(position)}/{fmtTime(duration)}</Text>
    </Box>
  )
}
