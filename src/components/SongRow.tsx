// src/components/SongRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { padTruncate } from '../framework/textWidth'
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

const TITLE_WIDTH = 36
const ARTIST_WIDTH = 22
const ALBUM_WIDTH = 22

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
  const trackNum = showTrackNumber
    ? (song.trackNumber ? `${song.trackNumber.toString().padStart(2)}.  ` : '    ')
    : ''
  const title = padTruncate(song.title, TITLE_WIDTH)
  const artist = showArtist ? '  ' + padTruncate(song.artist, ARTIST_WIDTH) : ''
  const album = showAlbum ? '  ' + padTruncate(song.album, ALBUM_WIDTH) : ''
  const duration = '  ' + fmtDuration(song.duration).padStart(5)

  return (
    <Box>
      <Text color={color} inverse={isCursor && !isPlaying}>
        {prefix}{trackNum}{title}{artist}{album}{duration}
      </Text>
    </Box>
  )
}
