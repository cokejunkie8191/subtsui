// src/components/AlbumArt.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { fetchAndRender, detectProtocol } from '../services/image'

const PROTOCOL = detectProtocol()

type Props = {
  coverArtUrl: string | null
  pixelSize: number
}

export function AlbumArt({ coverArtUrl, pixelSize }: Props) {
  const [rendered, setRendered] = useState<string | null>(null)

  useEffect(() => {
    if (!coverArtUrl) { setRendered(null); return }
    let cancelled = false
    fetchAndRender(coverArtUrl, pixelSize, PROTOCOL)
      .then(r => { if (!cancelled) setRendered(r) })
      .catch(() => setRendered(null))
    return () => { cancelled = true }
  }, [coverArtUrl, pixelSize])

  if (!rendered) {
    return <Box width={Math.ceil(pixelSize / 2)} height={Math.ceil(pixelSize / 4)}><Text>🎵</Text></Box>
  }
  return <Text>{rendered}</Text>
}
