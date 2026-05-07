// src/components/TabBar.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useNavStore, type Tab } from '../stores/nav.store'

const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'queue',   label: 'Queue' },
  { id: 'search',  label: 'Search' },
]

type Props = {
  highlight: string
  subtle: string
}

export function TabBar({ highlight, subtle }: Props) {
  const activeTab = useNavStore(s => s.activeTab)

  return (
    <Box paddingX={1}>
      {TABS.map((t) => {
        const isActive = t.id === activeTab
        return (
          <Box key={t.id} marginRight={2}>
            <Text color={isActive ? highlight : subtle} bold={isActive}>
              {isActive ? `[${t.label}]` : ` ${t.label} `}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
