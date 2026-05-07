// src/components/AlbumRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { padTruncate } from '../framework/textWidth'
import type { Album } from '../types/subsonic'

type Props = {
  album: Album
  isCursor: boolean
  highlight: string
  subtle: string
}

const NAME_WIDTH = 36
const ARTIST_WIDTH = 24

export function AlbumRow({ album, isCursor, highlight, subtle }: Props) {
  const color = isCursor ? highlight : subtle
  const prefix = isCursor ? '▶ ' : '  '
  const name = padTruncate(album.name, NAME_WIDTH)
  const artist = padTruncate(album.artist, ARTIST_WIDTH)
  const year = String(album.year ?? '----').padStart(4)

  return (
    <Box>
      <Text color={color} inverse={isCursor}>
        {prefix}{name}  {artist}  {year}
      </Text>
    </Box>
  )
}
