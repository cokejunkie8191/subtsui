// src/app.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Box, Text } from 'ink'
import { LoginScreen } from './screens/LoginScreen'
import { loadConfig, loadCredentials, saveCredentials } from './config/config'
import { SubsonicClient } from './services/subsonic'
import { MpvClient } from './services/mpv'
import { ScrobbleService } from './services/scrobble'
import { sendNowPlayingNotification } from './services/notify'
import {
  ServiceProvider,
  setGlobalController,
  useServices,
  type Services,
  type PlaybackController,
} from './framework/ServiceContext'
import { KeyRouter } from './framework/KeyRouter'
import { useNavStore, type Tab } from './stores/nav.store'
import { useQueueStore } from './stores/queue.store'
import { usePlayerStore } from './stores/player.store'
import { useStatusStore } from './stores/status.store'
import { TabBar } from './components/TabBar'
import { PlayerBar } from './components/PlayerBar'
import { StatusLine } from './components/StatusLine'
import { makeAlbumsScreen } from './screens/AlbumsScreen'
import { makeQueueScreen } from './screens/QueueScreen'
import { makeSearchScreen } from './screens/SearchScreen'
import { makeNowPlayingScreen } from './screens/NowPlayingScreen'
import type { AppConfig, Credentials } from './types/config'
import type { Song } from './types/subsonic'
import type { KeyEvent } from './framework/Screen'

type Phase = 'loading' | 'login' | 'main'

export function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig().then(cfg => {
      setConfig(cfg)
      loadCredentials().then(c => {
        if (c) {
          setCreds(c)
          setPhase('main')
        } else {
          setPhase('login')
        }
      })
    })
  }, [])

  async function handleLogin(c: Credentials) {
    setLoginError(null)
    await saveCredentials(c)
    setCreds(c)
    setPhase('main')
  }

  if (phase === 'loading' || !config) return <Text>Loading config...</Text>
  if (phase === 'login') return <LoginScreen onSubmit={handleLogin} error={loginError} />

  return <MainApp config={config} creds={creds!} onAuthError={(msg) => {
    setLoginError(msg)
    setPhase('login')
  }} />
}

function MainApp({ config, creds, onAuthError }: {
  config: AppConfig
  creds: Credentials
  onAuthError: (msg: string) => void
}) {
  const [services, setServices] = useState<Services | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      const subsonic = new SubsonicClient(creds)
      try {
        await subsonic.ping()
      } catch (e) {
        onAuthError(e instanceof Error ? e.message : 'Connection failed')
        return
      }

      const mpv = new MpvClient()
      try {
        await mpv.spawn({
          volume: config.app.defaultVolume,
          gapless: config.app.gaplessPlayback,
          replaygain: config.app.replaygain,
        })
      } catch (e) {
        useStatusStore.getState().setStatus('MPV failed to start', 'error')
        return
      }

      const scrobble = new ScrobbleService(
        (id, opts) => subsonic.scrobble(id, opts),
        { submitOnComplete: config.app.scrobbleSubmission },
      )

      // playbackController で再生関連の操作を一元化する
      const playSong = async (song: Song) => {
        // 前曲の scrobble 完了タイマーをキャンセル
        scrobble.onSongSkip()
        usePlayerStore.getState().setCurrentSong(song)
        try {
          await mpv.loadFile(subsonic.streamUrl(song.id))
        } catch (e) {
          useStatusStore.getState().setStatus('Failed to load track', 'error')
          return
        }
        scrobble.onSongStart(song)
        if (config.app.notifications) sendNowPlayingNotification(song).catch(() => {})
      }

      const controller: PlaybackController = {
        togglePause: () => mpv.togglePause(),
        next: async () => {
          scrobble.onSongSkip()
          const s = useQueueStore.getState().next()
          if (s) await playSong(s)
        },
        prev: async () => {
          scrobble.onSongSkip()
          const s = useQueueStore.getState().prev()
          if (s) await playSong(s)
        },
        volumeDelta: async (delta) => {
          const v = usePlayerStore.getState().volume
          await mpv.setVolume(Math.max(0, Math.min(100, v + delta)))
        },
        seekRelative: (sec) => mpv.seek(sec),
        seekTo:       (sec) => mpv.seekAbsolute(sec),
        toggleLoopMode: () => usePlayerStore.getState().nextLoopMode(),
        playSong,
      }

      setGlobalController(controller)

      // 曲終了時の loopMode 動作（呼び出し側で判定）
      mpv.on('end-file', async (reason: string) => {
        if (reason !== 'eof') return
        const lm = usePlayerStore.getState().loopMode
        const cur = usePlayerStore.getState().currentSong
        if (lm === 'one' && cur) {
          await playSong(cur)
          return
        }
        let s = useQueueStore.getState().next()
        if (!s && lm === 'all') {
          useQueueStore.getState().jumpTo(0)
          s = useQueueStore.getState().items[0] ?? null
        }
        if (s) await playSong(s)
      })

      // mpv 状態 polling と再接続
      let failureCount = 0
      const interval = setInterval(async () => {
        try {
          const status = await mpv.getStatus()
          usePlayerStore.getState().syncFromMpv(status)
          failureCount = 0
        } catch {
          failureCount++
          if (failureCount >= 5) {
            useStatusStore.getState().setStatus('MPV connection lost, restarting...', 'warn')
            try {
              await mpv.respawn({
                volume: usePlayerStore.getState().volume,
                gapless: config.app.gaplessPlayback,
                replaygain: config.app.replaygain,
              })
              useStatusStore.getState().setStatus('MPV reconnected', 'info', 2000)
              failureCount = 0
            } catch {
              useStatusStore.getState().setStatus('MPV unavailable', 'error')
            }
          }
        }
      }, 500)

      setServices({ subsonic, mpv, scrobble, controller, config })

      // 各タブのルートを populate
      useNavStore.getState().replaceStack('library', [makeAlbumsScreen()])
      useNavStore.getState().replaceStack('queue',   [makeQueueScreen()])
      useNavStore.getState().replaceStack('search',  [makeSearchScreen()])

      return () => {
        clearInterval(interval)
        setGlobalController(null)
        mpv.quit().catch(() => {})
      }
    }

    init()
  }, [])

  if (!services) return <Text>Initializing services...</Text>

  return (
    <ServiceProvider value={services}>
      <KeyRouter onGlobalKey={(e) => handleGlobalKey(e, services.controller)}>
        <ScreenHost />
      </KeyRouter>
    </ServiceProvider>
  )
}

function handleGlobalKey(e: KeyEvent, controller: PlaybackController) {
  // Enter は Layer 2 専用。Layer 2 で consume されなかった場合でも Layer 1 が誤動作しないよう防御
  if (e.key.return || e.input === '\r' || e.input === '\n') return
  if (e.input === ' ') return void controller.togglePause()
  if (e.input === 'n') return void controller.next()
  if (e.input === 'p') return void controller.prev()
  if (e.input === '+' || e.input === '=') return void controller.volumeDelta(+5)
  if (e.input === '-') return void controller.volumeDelta(-5)
  if (e.input === '<') return void controller.seekRelative(-10)
  if (e.input === '>') return void controller.seekRelative(+10)
  if (e.input === '.') return void controller.seekTo(0)
  if (e.input === 'l') return void controller.toggleLoopMode()
  if (e.input === 'M') {
    const nav = useNavStore.getState()
    if (nav.modal) nav.closeModal()
    else           nav.openModal(makeNowPlayingScreen())
    return
  }
  if (e.key.tab) {
    const nav = useNavStore.getState()
    const order: Tab[] = ['library', 'queue', 'search']
    const idx = order.indexOf(nav.activeTab)
    const nextIdx = (idx + (e.key.shift ? -1 + order.length : 1)) % order.length
    nav.setTab(order[nextIdx]!)
    return
  }
  if (e.input === '1') return void useNavStore.getState().setTab('library')
  if (e.input === '2') return void useNavStore.getState().setTab('queue')
  if (e.input === '3') return void useNavStore.getState().setTab('search')
  if (e.input === '/') {
    useNavStore.getState().setTab('search')
    return
  }
}

function ScreenHost() {
  const { config } = useServices()
  const activeTab = useNavStore(s => s.activeTab)
  const stacks = useNavStore(s => s.stacks)
  const modal = useNavStore(s => s.modal)

  const top = stacks[activeTab][stacks[activeTab].length - 1]
  const screen = modal ?? top

  const breadcrumb = stacks[activeTab].map(s => s.title).join(' > ') || '(empty)'

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <TabBar highlight={config.theme.highlight} subtle={config.theme.subtle} />
      <Box paddingX={1}>
        <Text color={config.theme.subtle} dimColor>{breadcrumb}</Text>
      </Box>
      <Box flexGrow={1} paddingX={1}>
        {screen ? screen.render() : <Text>(empty)</Text>}
      </Box>
      <PlayerBar />
      <StatusLine />
    </Box>
  )
}
