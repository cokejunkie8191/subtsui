// src/app.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text } from 'ink'
import { TabBar } from './components/layout/TabBar'
import { PlayerBar } from './components/layout/PlayerBar'
import { NowPlayingOverlay } from './components/layout/NowPlayingOverlay'
import { LibraryScreen } from './components/screens/LibraryScreen'
import { QueueScreen } from './components/screens/QueueScreen'
import { SearchScreen } from './components/screens/SearchScreen'
import { SettingsScreen } from './components/screens/SettingsScreen'
import { LoginScreen } from './components/screens/LoginScreen'
import { useUiStore } from './stores/ui.store'
import { usePlayerStore } from './stores/player.store'
import { useQueueStore } from './stores/queue.store'
import { useLibraryStore } from './stores/library.store'
import { useKeyHandler } from './hooks/useKeyHandler'
import { useMpvSync } from './hooks/useMpvSync'
import { SubsonicClient } from './services/subsonic'
import { MpvClient } from './services/mpv'
import { ScrobbleService } from './services/scrobble'
import { sendNowPlayingNotification } from './services/notify'
import { loadConfig, loadCredentials, saveCredentials } from './config/config'
import type { AppConfig, Credentials } from './types/config'

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [subsonic, setSubsonic] = useState<SubsonicClient | null>(null)
  const [mpv, setMpv] = useState<MpvClient | null>(null)
  const [scrobble, setScrobble] = useState<ScrobbleService | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  const { activeTab, showNowPlaying, showLogin, setTab, nextTab, prevTab, toggleNowPlaying, setShowLogin } = useUiStore()
  const { nextLoopMode, volume } = usePlayerStore()
  const { next, prev } = useQueueStore()
  const { setCurrentSong } = usePlayerStore()

  useMpvSync(mpv)

  useEffect(() => {
    loadConfig().then(cfg => {
      setConfig(cfg)
      loadCredentials().then(creds => {
        if (!creds) { setShowLogin(true); return }
        initPlayer(creds, cfg)
      })
    })
  }, [])

  async function initPlayer(creds: Credentials, cfg: AppConfig) {
    const client = new SubsonicClient(creds)
    try {
      await client.ping()
    } catch {
      setLoginError('Cannot connect to server. Check credentials.')
      setShowLogin(true)
      return
    }

    const mpvClient = new MpvClient()
    await mpvClient.spawn({
      volume: cfg.app.defaultVolume,
      gapless: cfg.app.gaplessPlayback,
      replaygain: cfg.app.replaygain,
    })

    const scrobbleService = new ScrobbleService((id, opts) => client.scrobble(id, opts))

    mpvClient.on('end-file', async (reason: string) => {
      if (reason !== 'eof') return
      const nextSong = next()
      if (!nextSong) return
      const url = client.streamUrl(nextSong.id)
      await mpvClient.loadFile(url)
      setCurrentSong(nextSong)
      scrobbleService.onSongStart(nextSong)
      if (cfg.app.notifications) sendNowPlayingNotification(nextSong).catch(() => {})
    })

    setSubsonic(client)
    setMpv(mpvClient)
    setScrobble(scrobbleService)
    setShowLogin(false)
  }

  async function handleLogin(creds: Credentials) {
    setLoginError(null)
    await saveCredentials(creds)
    const cfg = config ?? (await loadConfig())
    await initPlayer(creds, cfg)
  }

  const handleAction = useCallback(async (category: string, action: string) => {
    if (category === 'navigation') {
      const lib = useLibraryStore.getState()
      const queue = useQueueStore.getState()

      if (action === 'up') lib.moveCursor(-1)
      if (action === 'down') lib.moveCursor(1)
      if (action === 'top') lib.setCursor(0)
      if (action === 'bottom') {
        const list = lib.view === 'albums' ? lib.albums : lib.view === 'artists' ? lib.artists : lib.songs
        lib.setCursor(list.length - 1)
      }
      if (action === 'filter_next') {
        const views = ['songs', 'albums', 'artists', 'playlists', 'starred'] as const
        const next = views[(views.indexOf(lib.view) + 1) % views.length]
        lib.setView(next)
      }
      if (action === 'filter_prev') {
        const views = ['songs', 'albums', 'artists', 'playlists', 'starred'] as const
        const prev = views[(views.indexOf(lib.view) - 1 + views.length) % views.length]
        lib.setView(prev)
      }
      if (action === 'select' && mpv && subsonic && scrobble) {
        if (lib.view === 'songs' || lib.view === 'starred') {
          const song = lib.songs[lib.cursor]
          if (!song) return
          queue.clear()
          lib.songs.slice(lib.cursor + 1).forEach(s => queue.enqueueLast(s))
          queue.setCurrentIndex(0)
          await mpv.loadFile(subsonic.streamUrl(song.id))
          setCurrentSong(song)
          scrobble.onSongStart(song)
          if (config?.app.notifications) sendNowPlayingNotification(song).catch(() => {})
        }
      }
      return
    }

    if (!mpv || !subsonic || !scrobble) return

    if (category === 'playback') {
      if (action === 'play_pause') await mpv.togglePause()
      if (action === 'next') {
        scrobble.onSongSkip()
        const s = next()
        if (s) { await mpv.loadFile(subsonic.streamUrl(s.id)); setCurrentSong(s); scrobble.onSongStart(s) }
      }
      if (action === 'prev') {
        scrobble.onSongSkip()
        const s = prev()
        if (s) { await mpv.loadFile(subsonic.streamUrl(s.id)); setCurrentSong(s); scrobble.onSongStart(s) }
      }
      if (action === 'volume_up') await mpv.setVolume(volume + 5)
      if (action === 'volume_down') await mpv.setVolume(Math.max(0, volume - 5))
      if (action === 'loop') nextLoopMode()
      if (action === 'rewind') await mpv.seek(-10)
      if (action === 'forward') await mpv.seek(10)
      if (action === 'restart') await mpv.seekAbsolute(0)
      if (action === 'toggle_now_playing') toggleNowPlaying()
    }

    if (category === 'global') {
      if (action === 'tab_next') nextTab()
      if (action === 'tab_prev') prevTab()
      if (action === 'tab_1') setTab('library')
      if (action === 'tab_2') setTab('queue')
      if (action === 'tab_3') setTab('search')
      if (action === 'tab_4') setTab('settings')
      if (action === 'quit') { await mpv.quit(); process.exit(0) }
    }
  }, [mpv, subsonic, scrobble, config, volume, next, prev, nextTab, prevTab, setTab, toggleNowPlaying, nextLoopMode, setCurrentSong])

  if (!config) return <Text>Loading...</Text>
  if (showLogin) return <LoginScreen onLogin={handleLogin} error={loginError} />

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <TabBar activeTab={activeTab} highlight={config.theme.highlight} subtle={config.theme.subtle} />
      <Box flexGrow={1} padding={1} overflow="hidden">
        {showNowPlaying ? (
          <NowPlayingOverlay config={config} subsonic={subsonic} />
        ) : activeTab === 'library' && subsonic && mpv && scrobble ? (
          <LibraryScreen config={config} subsonic={subsonic} mpv={mpv} scrobble={scrobble} />
        ) : activeTab === 'queue' ? (
          <QueueScreen config={config} />
        ) : activeTab === 'search' && subsonic ? (
          <SearchScreen config={config} subsonic={subsonic} />
        ) : (
          <SettingsScreen config={config} />
        )}
      </Box>
      <PlayerBar config={config} subsonic={subsonic} />
      {config && <AppKeyHandler config={config} onAction={handleAction} />}
    </Box>
  )
}

function AppKeyHandler({ config, onAction }: { config: AppConfig; onAction: (c: string, a: string) => void }) {
  useKeyHandler(config, onAction)
  return null
}
