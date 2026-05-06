// src/services/mpv.ts
import { createConnection, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import type { MpvStatus } from '../types/player'

type MpvResponse = { request_id: number; error: string; data?: any }
type PendingRequest = { resolve: (v: any) => void; reject: (e: Error) => void }

export class MpvClient extends EventEmitter {
  private socket: Socket | null = null
  private pending = new Map<number, PendingRequest>()
  private nextId = 1
  private buffer = ''
  private process: ReturnType<typeof Bun.spawn> | null = null
  readonly socketPath: string

  constructor(socketPath?: string) {
    super()
    const uid = process.getuid?.() ?? 0
    this.socketPath = socketPath ?? `/tmp/tuimusic_mpv_${uid}.sock`
  }

  async spawn(opts: {
    volume?: number
    gapless?: 'yes' | 'no' | 'weak'
    replaygain?: 'track' | 'album' | 'no'
  } = {}): Promise<void> {
    // 既存プロセスのクリーンアップ
    await this.quit().catch(() => {})

    this.process = Bun.spawn([
      'mpv',
      '--idle',
      '--no-video',
      `--input-ipc-server=${this.socketPath}`,
      `--gapless-audio=${opts.gapless ?? 'yes'}`,
      '--prefetch-playlist=yes',
      `--replaygain=${opts.replaygain ?? 'track'}`,
    ], { stdout: 'ignore', stderr: 'ignore', env: process.env })

    // ソケット作成を待つ（最大1秒）
    for (let i = 0; i < 100; i++) {
      await Bun.sleep(10)
      try {
        await this.connect()
        return
      } catch {}
    }
    throw new Error('MPV socket did not appear within 1s')
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = createConnection(this.socketPath)
      sock.once('connect', () => {
        this.socket = sock
        sock.on('data', chunk => this.onData(chunk.toString()))
        sock.on('close', () => this.emit('disconnect'))
        resolve()
      })
      sock.once('error', reject)
    })
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line) as MpvResponse
        if ('request_id' in msg) {
          const p = this.pending.get(msg.request_id)
          if (p) {
            this.pending.delete(msg.request_id)
            if (msg.error === 'success') p.resolve(msg.data)
            else p.reject(new Error(msg.error))
          }
        } else if ((msg as any).event === 'end-file') {
          this.emit('end-file', (msg as any).reason)
        }
      } catch {}
    }
  }

  private send(command: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('MPV not connected'))
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      const msg = JSON.stringify({ command, request_id: id }) + '\n'
      this.socket.write(msg)
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('MPV command timeout'))
        }
      }, 5000)
    })
  }

  async loadFile(url: string, startPaused = false): Promise<void> {
    const mode = startPaused ? 'replace' : 'replace'
    await this.send(['loadfile', url, mode])
    if (startPaused) await this.setPause(true)
  }

  async appendFile(url: string): Promise<void> {
    await this.send(['loadfile', url, 'append'])
  }

  async togglePause(): Promise<void> {
    await this.send(['cycle', 'pause'])
  }

  async setPause(paused: boolean): Promise<void> {
    await this.send(['set_property', 'pause', paused])
  }

  async stop(): Promise<void> {
    await this.send(['stop'])
  }

  async seek(seconds: number): Promise<void> {
    await this.send(['seek', seconds, 'relative'])
  }

  async seekAbsolute(seconds: number): Promise<void> {
    await this.send(['seek', seconds, 'absolute'])
  }

  async setVolume(volume: number): Promise<void> {
    await this.send(['set_property', 'volume', Math.max(0, Math.min(100, volume))])
  }

  async getStatus(): Promise<MpvStatus> {
    const [paused, pos, dur, vol, path] = await Promise.all([
      this.send(['get_property', 'pause']),
      this.send(['get_property', 'time-pos']).catch(() => 0),
      this.send(['get_property', 'duration']).catch(() => 0),
      this.send(['get_property', 'volume']).catch(() => 80),
      this.send(['get_property', 'path']).catch(() => null),
    ])
    return {
      paused: !!paused,
      position: Number(pos ?? 0),
      duration: Number(dur ?? 0),
      volume: Number(vol ?? 80),
      path: path ?? null,
    }
  }

  async quit(): Promise<void> {
    await this.send(['quit']).catch(() => {})
    this.socket?.destroy()
    this.socket = null
    this.process?.kill()
    this.process = null
  }
}
