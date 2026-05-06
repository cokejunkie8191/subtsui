// src/screens/QueueScreen.tsx
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useQueueStore } from '../stores/queue.store'
import { useServices, triggerPlay } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import type { Screen, KeyEvent } from '../framework/Screen'

const useCursor = create<{ cursor: number; set: (n: number) => void }>((set) => ({
  cursor: 0,
  set: (n) => set({ cursor: n }),
}))

function QueueView() {
  const { config } = useServices()
  const items = useQueueStore(s => s.items)
  const currentIndex = useQueueStore(s => s.currentIndex)
  const cursor = useCursor(s => s.cursor)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  if (items.length === 0) {
    return <Text color={config.theme.subtle}>Queue is empty.</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color={config.theme.highlight} bold>
        Queue ({items.length} tracks)
      </Text>
      <Text color={config.theme.subtle} dimColor>
        Enter: jump to song · x: remove · X: clear
      </Text>
      <WindowList
        items={items}
        cursor={cursor}
        height={winHeight}
        renderItem={(song, i, isCursor) => (
          <SongRow song={song} isCursor={isCursor} isPlaying={i === currentIndex}
                   showTrackNumber={false}
                   highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeQueueScreen(): Screen {
  return {
    id: 'queue',
    title: 'Queue',
    render: () => <QueueView />,
    onKey: (e: KeyEvent) => {
      const items = useQueueStore.getState().items
      const max = items.length - 1
      const c = useCursor.getState().cursor
      const set = useCursor.getState().set

      if (e.input === 'j' || e.key.downArrow) { set(Math.min(max, c + 1)); return true }
      if (e.input === 'k' || e.key.upArrow)   { set(Math.max(0,   c - 1)); return true }
      if (e.input === 'g')                    { set(0);             return true }
      if (e.input === 'G')                    { set(max);           return true }

      if (e.key.return) {
        const song = items[c]
        if (song) {
          useQueueStore.getState().jumpTo(c)
          triggerPlay(song)
        }
        return true
      }

      if (e.input === 'x') {
        useQueueStore.getState().remove(c)
        const newMax = useQueueStore.getState().items.length - 1
        if (c > newMax) set(Math.max(0, newMax))
        return true
      }

      if (e.input === 'X') {
        useQueueStore.getState().clear()
        set(0)
        return true
      }

      return false
    },
  }
}
