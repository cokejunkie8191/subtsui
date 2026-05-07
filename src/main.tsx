#!/usr/bin/env bun
import React from 'react'
import { render } from 'ink'
import { App } from './app'
import { quit } from './framework/ServiceContext'

const { unmount } = render(<App />, { patchConsole: true, exitOnCtrlC: false })

process.on('SIGTERM', async () => { unmount(); await quit() })
process.on('SIGINT',  async () => { unmount(); await quit() })
