// src/components/SongRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Song } from '../types/subsonic'

type Props = {
  song: Song
  isCursor: boolean
  isPlaying: boolean
  showTrackNumber?: boolean
  showAlbum?: boolean
  showArtist?: boolean
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s.padEnd(len)
  return s.slice(0, len - 1) + '…'
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SongRow({
  song, isCursor, isPlaying,
  showTrackNumber = true, showAlbum = false, showArtist = true,
  highlight, subtle,
}: Props) {
  const color = isPlaying ? highlight : isCursor ? highlight : subtle
  const prefix = isPlaying ? '▶ ' : isCursor ? '▶ ' : '  '

  return (
    <Box>
      <Text color={color} inverse={isCursor && !isPlaying}>
        {prefix}
        {showTrackNumber && (song.trackNumber ? `${song.trackNumber.toString().padStart(2)}.  ` : '    ')}
        {truncate(song.title, 32)}
        {showArtist && `  ${truncate(song.artist, 20)}`}
        {showAlbum && `  ${truncate(song.album, 20)}`}
        {`  ${fmtDuration(song.duration)}`}
      </Text>
    </Box>
  )
}
