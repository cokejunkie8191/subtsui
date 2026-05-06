// src/components/shared/SongTable.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Song } from '../../types/subsonic'
import type { ColumnsConfig } from '../../types/config'

type Props = {
  songs: Song[]
  cursor: number
  currentSongId?: string
  columns: ColumnsConfig
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len)
}

function ratingStr(r: number): string {
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SongTable({ songs, cursor, currentSongId, columns, highlight, subtle }: Props) {
  return (
    <Box flexDirection="column">
      {songs.map((song, i) => {
        const isPlaying = song.id === currentSongId
        const isSelected = i === cursor
        const color = isPlaying ? highlight : isSelected ? '#ffffff' : subtle
        const bg = isSelected && !isPlaying ? '#1e293b' : undefined

        return (
          <Box key={song.id} backgroundColor={bg}>
            <Text color={isPlaying ? highlight : subtle}>{isPlaying ? '▶ ' : '  '}</Text>
            {columns.trackNumber && <Text color={color}>{String(song.trackNumber ?? '').padStart(2)} </Text>}
            {columns.title && <Text color={color}>{truncate(song.title, 28)}</Text>}
            {columns.artist && <Text color={color}> {truncate(song.artist, 18)}</Text>}
            {columns.album && <Text color={color}> {truncate(song.album, 18)}</Text>}
            {columns.year && <Text color={color}> {String(song.year ?? '').padStart(4)}</Text>}
            {columns.rating && <Text color={color}> {ratingStr(song.rating)}</Text>}
            {columns.duration && <Text color={color}> {fmtDuration(song.duration)}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}
