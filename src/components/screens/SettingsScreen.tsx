// src/components/screens/SettingsScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { AppConfig } from '../../types/config'

type Props = { config: AppConfig }

export function SettingsScreen({ config }: Props) {
  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text color={config.theme.highlight} bold>Settings</Text>
      <Text color={config.theme.subtle}>Edit ~/.config/subtsui/config.toml to change settings.</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text color={config.theme.subtle}>Volume: {config.app.defaultVolume}</Text>
        <Text color={config.theme.subtle}>Gapless: {config.app.gaplessPlayback}</Text>
        <Text color={config.theme.subtle}>ReplayGain: {config.app.replaygain}</Text>
        <Text color={config.theme.subtle}>Notifications: {config.app.notifications ? 'on' : 'off'}</Text>
      </Box>
    </Box>
  )
}
