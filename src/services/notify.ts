// src/services/notify.ts
import type { Song } from '../types/subsonic'

export async function sendNowPlayingNotification(song: Song): Promise<void> {
  const title = song.title
  const body = `${song.artist} — ${song.album}`

  // macOS: osascript
  if (process.platform === 'darwin') {
    await Bun.spawn([
      'osascript', '-e',
      `display notification "${body}" with title "${title}"`,
    ]).exited.catch(() => {})
    return
  }

  // Linux: notify-send
  if (process.platform === 'linux') {
    await Bun.spawn(['notify-send', title, body]).exited.catch(() => {})
  }
}
