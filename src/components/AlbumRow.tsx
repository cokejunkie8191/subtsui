// src/components/AlbumRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Album } from '../types/subsonic'

type Props = {
  album: Album
  isCursor: boolean
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s.padEnd(len)
  return s.slice(0, len - 1) + '…'
}

export function AlbumRow({ album, isCursor, highlight, subtle }: Props) {
  const color = isCursor ? highlight : subtle
  const prefix = isCursor ? '▶ ' : '  '
  return (
    <Box>
      <Text color={color} inverse={isCursor}>
        {prefix}
        {truncate(album.name, 28)}  {truncate(album.artist, 22)}  {album.year ?? '----'}
      </Text>
    </Box>
  )
}
