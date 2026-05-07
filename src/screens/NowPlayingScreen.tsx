// src/screens/NowPlayingScreen.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { usePlayerStore } from '../stores/player.store'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { AlbumArt } from '../components/AlbumArt'
import { ProgressBar } from '../components/ProgressBar'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import type { StructuredLyrics } from '../types/subsonic'

function NowPlayingView() {
  const { subsonic, config } = useServices()
  const currentSong = usePlayerStore(s => s.currentSong)
  const position = usePlayerStore(s => s.position)
  const duration = usePlayerStore(s => s.duration)
  const [lyrics, setLyrics] = useState<StructuredLyrics | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80

  useEffect(() => {
    if (!currentSong) { setLyrics(null); return }
    safeLoad(() => subsonic.getLyrics(currentSong.id), 'Failed to load lyrics').then(setLyrics)
  }, [currentSong?.id])

  if (!currentSong) {
    return (
      <Box padding={2} flexDirection="column">
        <Text color={config.theme.subtle}>No track playing</Text>
        <Text color={config.theme.subtle} dimColor>M / Esc to close</Text>
      </Box>
    )
  }

  const coverArtUrl = subsonic.coverArtUrl(currentSong.albumId, 300)
  // blocks プロトコルでは pixelSize = 文字セル単位で、出力は pixelSize × pixelSize 文字
  // ターミナルの縦幅も考慮して 24 セル程度にキャップ
  const artSize = Math.min(Math.max(16, Math.floor(termWidth * 0.15)), 28)

  const currentLine = lyrics?.synced
    ? [...(lyrics.lines ?? [])].reverse().find(l => l.start / 1000 <= position)?.value
    : null

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={config.theme.highlight}>
      <Text color={config.theme.highlight} bold> Now Playing</Text>
      <Box gap={2} marginTop={1}>
        <AlbumArt coverArtUrl={coverArtUrl} pixelSize={artSize} />
        <Box flexDirection="column" flexGrow={1} gap={1}>
          <Text color="#ffffff" bold>{currentSong.title}</Text>
          <Text color={config.theme.subtle}>{currentSong.artist}</Text>
          <Text color={config.theme.subtle}>
            {currentSong.album}{currentSong.year ? ` (${currentSong.year})` : ''}
          </Text>
          <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
          {currentLine && (
            <Box marginTop={1}>
              <Text color={config.theme.highlight} italic>{currentLine}</Text>
            </Box>
          )}
        </Box>
      </Box>
      <Text color={config.theme.subtle} dimColor> M / Esc to close</Text>
    </Box>
  )
}

export function makeNowPlayingScreen(): Screen {
  return {
    id: 'now-playing',
    title: 'Now Playing',
    isModal: true,
    render: () => <NowPlayingView />,
    onKey: (e: KeyEvent) => {
      if (e.key.escape || e.input === 'M') {
        useNavStore.getState().closeModal()
        return true
      }
      return false
    },
  }
}
