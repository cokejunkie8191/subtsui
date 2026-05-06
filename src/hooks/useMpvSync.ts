// src/hooks/useMpvSync.ts
import { useEffect } from 'react'
import { usePlayerStore } from '../stores/player.store'
import type { MpvClient } from '../services/mpv'

export function useMpvSync(mpv: MpvClient | null) {
  const syncFromMpv = usePlayerStore(s => s.syncFromMpv)
  const setError = usePlayerStore(s => s.setError)

  useEffect(() => {
    if (!mpv) return
    const interval = setInterval(async () => {
      try {
        const status = await mpv.getStatus()
        syncFromMpv(status)
      } catch {
        setError('MPV disconnected')
      }
    }, 500)
    return () => clearInterval(interval)
  }, [mpv])
}
