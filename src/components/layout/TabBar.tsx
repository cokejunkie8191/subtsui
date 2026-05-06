// src/components/layout/TabBar.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { ActiveTab } from '../../stores/ui.store'

type Props = {
  activeTab: ActiveTab
  highlight: string
  subtle: string
}

const TABS: { id: ActiveTab; label: string; key: string }[] = [
  { id: 'library', label: 'Library', key: '1' },
  { id: 'queue', label: 'Queue', key: '2' },
  { id: 'search', label: 'Search', key: '3' },
  { id: 'settings', label: 'Settings', key: '4' },
]

export function TabBar({ activeTab, highlight, subtle }: Props) {
  return (
    <Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor="#334155">
      {TABS.map(tab => (
        <Box key={tab.id} marginRight={1}>
          <Text
            color={tab.id === activeTab ? highlight : subtle}
            underline={tab.id === activeTab}
          >
            [{tab.key}]{tab.label}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
