// src/main.tsx
import React from 'react'
import { render } from 'ink'
import { App } from './app'

const { unmount } = render(<App />, { patchConsole: true })

process.on('SIGTERM', () => { unmount(); process.exit(0) })
process.on('SIGINT', () => { unmount(); process.exit(0) })
