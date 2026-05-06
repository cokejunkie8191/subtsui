// src/components/screens/LoginScreen.tsx
import React, { useState } from 'react'
import { Box, Text, TextInput } from 'ink'
import type { Credentials } from '../../types/config'

type Props = {
  onLogin: (creds: Credentials) => void
  error?: string | null
}

export function LoginScreen({ onLogin, error }: Props) {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [field, setField] = useState<'url' | 'username' | 'password'>('url')

  function submit() {
    if (url && username && password) {
      onLogin({ url: url.replace(/\/$/, ''), authMethod: 'plaintext', username, password })
    }
  }

  return (
    <Box flexDirection="column" padding={2} gap={1}>
      <Text color="#7dd3fc" bold>TUI Music Player — Login</Text>
      <Box gap={1}>
        <Text color={field === 'url' ? '#7dd3fc' : '#6b7280'}>Server URL:</Text>
        <TextInput
          value={url}
          onChange={setUrl}
          onSubmit={() => setField('username')}
          placeholder="https://subsonic.example.com"
          focus={field === 'url'}
        />
      </Box>
      <Box gap={1}>
        <Text color={field === 'username' ? '#7dd3fc' : '#6b7280'}>Username:  </Text>
        <TextInput
          value={username}
          onChange={setUsername}
          onSubmit={() => setField('password')}
          focus={field === 'username'}
        />
      </Box>
      <Box gap={1}>
        <Text color={field === 'password' ? '#7dd3fc' : '#6b7280'}>Password:  </Text>
        <TextInput
          value={password}
          onChange={setPassword}
          onSubmit={submit}
          mask="*"
          focus={field === 'password'}
        />
      </Box>
      {error && <Text color="#f87171">{error}</Text>}
      <Text color="#6b7280">Tab to move between fields, Enter to submit</Text>
    </Box>
  )
}
