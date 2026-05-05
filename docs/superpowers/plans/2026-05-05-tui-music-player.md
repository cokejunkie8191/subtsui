# TUI Music Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subsonic API 対応の TypeScript TUI 音楽プレイヤーを Bun + Ink + Zustand で構築する。

**Architecture:** サービス層（Subsonic API / MPV IPC / Scrobble）→ Zustand ストア（4スライス）→ Ink コンポーネント（タブ型フルワイドレイアウト）の順に積み上げる。各レイヤーは独立してテスト可能。

**Tech Stack:** Bun, Ink v5 (React), Zustand, smol-toml, jimp, lru-cache

> **NOTE:** `<appname>` はアプリ名未定につきプレースホルダー。実装開始前に決定し全ファイルで置き換えること（例: `tuimusic`）。

---

## File Map

```
/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── app.tsx
│   ├── types/
│   │   ├── subsonic.ts
│   │   ├── player.ts
│   │   └── config.ts
│   ├── config/
│   │   ├── defaults.ts
│   │   ├── config.ts
│   │   └── keybinds.ts
│   ├── services/
│   │   ├── subsonic.ts
│   │   ├── mpv.ts
│   │   ├── scrobble.ts
│   │   ├── image.ts
│   │   └── notify.ts
│   ├── stores/
│   │   ├── player.store.ts
│   │   ├── queue.store.ts
│   │   ├── library.store.ts
│   │   └── ui.store.ts
│   ├── hooks/
│   │   ├── useKeyHandler.ts
│   │   └── useMpvSync.ts
│   └── components/
│       ├── layout/
│       │   ├── TabBar.tsx
│       │   ├── PlayerBar.tsx
│       │   └── NowPlayingOverlay.tsx
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── LibraryScreen.tsx
│       │   ├── QueueScreen.tsx
│       │   ├── SearchScreen.tsx
│       │   └── SettingsScreen.tsx
│       └── shared/
│           ├── SongTable.tsx
│           ├── AlbumArt.tsx
│           └── ProgressBar.tsx
└── tests/
    ├── unit/
    │   ├── scrobble.test.ts
    │   ├── queue.test.ts
    │   ├── config.test.ts
    │   ├── keybinds.test.ts
    │   └── image.test.ts
    └── integration/
        └── subsonic.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/main.tsx`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "<appname>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "bun run src/main.tsx",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "react": "^18.3.1",
    "zustand": "^5.0.0",
    "smol-toml": "^1.3.0",
    "jimp": "^1.6.0",
    "lru-cache": "^11.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: tsconfig.json を作成**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 依存パッケージをインストール**

```bash
bun install
```

Expected: `node_modules/` が作成され `bun.lockb` が生成される。

- [ ] **Step 4: 動作確認用の main.tsx を作成**

```tsx
// src/main.tsx
import React from 'react'
import { render, Text } from 'ink'

render(<Text color="green">TUI Player starting...</Text>)
```

- [ ] **Step 5: 起動確認**

```bash
bun run src/main.tsx
```

Expected: `TUI Player starting...` が緑色で表示される。

- [ ] **Step 6: コミット**

```bash
git add package.json tsconfig.json src/main.tsx bun.lockb
git commit -m "chore: project scaffold (Bun + Ink + Zustand)"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/types/subsonic.ts`
- Create: `src/types/player.ts`
- Create: `src/types/config.ts`

- [ ] **Step 1: src/types/subsonic.ts を作成**

```typescript
// src/types/subsonic.ts
export type Song = {
  id: string
  title: string
  artist: string
  artistId: string
  album: string
  albumId: string
  duration: number      // 秒
  rating: number        // 0-5
  genre?: string
  year?: number
  trackNumber?: number
  playCount?: number
  path?: string
  starred?: boolean
}

export type Album = {
  id: string
  name: string
  artist: string
  artistId: string
  songCount: number
  duration: number
  year?: number
  genre?: string
  rating: number
  starred?: boolean
  coverArt?: string
}

export type Artist = {
  id: string
  name: string
  albumCount: number
  rating: number
  starred?: boolean
}

export type Playlist = {
  id: string
  name: string
  songCount?: number
}

export type LyricLine = {
  start: number   // ミリ秒
  value: string
}

export type StructuredLyrics = {
  synced: boolean
  lines: LyricLine[]
}

export type SearchResult = {
  artists: Artist[]
  albums: Album[]
  songs: Song[]
}
```

- [ ] **Step 2: src/types/player.ts を作成**

```typescript
// src/types/player.ts
export type PlaybackStatus = 'playing' | 'paused' | 'stopped'
export type LoopMode = 'none' | 'all' | 'one'

export type MpvStatus = {
  paused: boolean
  position: number    // 秒
  duration: number    // 秒
  volume: number      // 0-100
  path: string | null
}
```

- [ ] **Step 3: src/types/config.ts を作成**

```typescript
// src/types/config.ts
export type AuthMethod = 'plaintext' | 'hashed' | 'api_key'

export type Credentials = {
  url: string
  authMethod: AuthMethod
  username: string
  password?: string
  passwordToken?: string
  passwordSalt?: string
  apiKey?: string
}

export type ThemeConfig = {
  highlight: string
  subtle: string
  special: string
}

export type FiltersConfig = {
  minDuration: number
  titles: string[]
  genres: string[]
  excludeFavorites: boolean
}

export type ColumnsConfig = {
  trackNumber: boolean
  title: boolean
  artist: boolean
  album: boolean
  year: boolean
  rating: boolean
  duration: boolean
}

export type AppConfig = {
  app: {
    defaultVolume: number
    gaplessPlayback: 'yes' | 'no' | 'weak'
    replaygain: 'track' | 'album' | 'no'
    notifications: boolean
  }
  theme: ThemeConfig
  filters: FiltersConfig
  columns: { songs: ColumnsConfig }
  keybinds: Record<string, Record<string, string[]>>
}
```

- [ ] **Step 4: コミット**

```bash
git add src/types/
git commit -m "feat: core TypeScript types (Song, Album, Artist, Config)"
```

---

## Task 3: Config System

**Files:**
- Create: `src/config/defaults.ts`
- Create: `src/config/config.ts`
- Create: `tests/unit/config.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, mergeConfig } from '../../src/config/config'
import type { AppConfig } from '../../src/types/config'

describe('mergeConfig', () => {
  test('ユーザー設定でデフォルトを上書きする', () => {
    const defaults = { app: { defaultVolume: 80, notifications: true } }
    const user = { app: { defaultVolume: 60 } }
    const result = mergeConfig(defaults as any, user as any)
    expect(result.app.defaultVolume).toBe(60)
    expect(result.app.notifications).toBe(true)
  })

  test('ネストしたオブジェクトを再帰的にマージする', () => {
    const defaults = { theme: { highlight: '#fff', subtle: '#888' } }
    const user = { theme: { highlight: '#0af' } }
    const result = mergeConfig(defaults as any, user as any)
    expect(result.theme.highlight).toBe('#0af')
    expect(result.theme.subtle).toBe('#888')
  })
})

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tuimusic-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('設定ファイルが存在しない場合はデフォルトを返す', async () => {
    const config = await loadConfig(join(tmpDir, 'nonexistent'))
    expect(config.app.defaultVolume).toBe(80)
  })

  test('TOML ファイルを読み込んでデフォルトとマージする', async () => {
    await writeFile(join(tmpDir, 'config.toml'), `
[app]
default_volume = 60
`)
    const config = await loadConfig(tmpDir)
    expect(config.app.defaultVolume).toBe(60)
    expect(config.app.notifications).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/unit/config.test.ts
```

Expected: FAIL — `Cannot find module '../../src/config/config'`

- [ ] **Step 3: src/config/defaults.ts を作成**

```typescript
// src/config/defaults.ts
import type { AppConfig } from '../types/config'

export const DEFAULT_CONFIG: AppConfig = {
  app: {
    defaultVolume: 80,
    gaplessPlayback: 'yes',
    replaygain: 'track',
    notifications: true,
  },
  theme: {
    highlight: '#7dd3fc',
    subtle: '#6b7280',
    special: '#f472b6',
  },
  filters: {
    minDuration: 0,
    titles: [],
    genres: [],
    excludeFavorites: false,
  },
  columns: {
    songs: {
      trackNumber: true,
      title: true,
      artist: true,
      album: true,
      year: true,
      rating: true,
      duration: true,
    },
  },
  keybinds: {
    playback: {
      play_pause: ['space'],
      next: ['n'],
      prev: ['p'],
      volume_up: ['+', '='],
      volume_down: ['-'],
      loop: ['l'],
      shuffle: ['S'],
      rewind: ['<'],
      forward: ['>'],
      restart: ['.'],
      toggle_now_playing: ['M'],
    },
    navigation: {
      up: ['j', 'up'],
      down: ['k', 'down'],
      top: ['g'],
      bottom: ['G'],
      select: ['return'],
      shuffle_play: ['S-return'],
      filter_next: ['f'],
      filter_prev: ['F'],
      go_to_album: ['a'],
      go_to_artist: ['r'],
    },
    queue: {
      enqueue_last: ['q'],
      enqueue_next: ['Q'],
      remove: ['x'],
      clear: ['X'],
    },
    global: {
      tab_next: ['tab'],
      tab_prev: ['S-tab'],
      tab_1: ['1'],
      tab_2: ['2'],
      tab_3: ['3'],
      tab_4: ['4'],
      search: ['/'],
      star: ['*'],
      rate: ['R'],
      playlist_add: ['P'],
      help: ['?'],
      back: ['escape'],
      quit: ['Z'],
    },
  },
}
```

- [ ] **Step 4: src/config/config.ts を作成**

```typescript
// src/config/config.ts
import { parse } from 'smol-toml'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { AppConfig, Credentials } from '../types/config'
import { DEFAULT_CONFIG } from './defaults'

export function mergeConfig<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object') {
      result[key] = mergeConfig(defaults[key] as any, val as any)
    } else if (val !== undefined) {
      result[key] = val as T[keyof T]
    }
  }
  return result
}

function tomlToAppConfig(raw: Record<string, any>): Partial<AppConfig> {
  const out: any = {}
  if (raw.app) {
    out.app = {
      defaultVolume: raw.app.default_volume,
      gaplessPlayback: raw.app.gapless_playback,
      replaygain: raw.app.replaygain,
      notifications: raw.app.notifications,
    }
  }
  if (raw.theme) out.theme = raw.theme
  if (raw.filters) {
    out.filters = {
      minDuration: raw.filters.min_duration,
      titles: raw.filters.titles,
      genres: raw.filters.genres,
      excludeFavorites: raw.filters.exclude_favorites,
    }
  }
  if (raw.columns) out.columns = raw.columns
  if (raw.keybinds) out.keybinds = raw.keybinds
  return out
}

export async function loadConfig(configDir?: string): Promise<AppConfig> {
  const dir = configDir ?? join(homedir(), '.config', '<appname>')
  try {
    const raw = await readFile(join(dir, 'config.toml'), 'utf8')
    const parsed = parse(raw) as Record<string, any>
    return mergeConfig(DEFAULT_CONFIG, tomlToAppConfig(parsed))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function loadCredentials(configDir?: string): Promise<Credentials | null> {
  const dir = configDir ?? join(homedir(), '.config', '<appname>')
  try {
    const raw = await readFile(join(dir, 'credentials.toml'), 'utf8')
    const parsed = parse(raw) as any
    if (!parsed?.server?.url || !parsed?.server?.username) return null
    return {
      url: parsed.server.url.replace(/\/$/, ''),
      authMethod: parsed.server.auth_method ?? 'plaintext',
      username: parsed.server.username,
      password: parsed.server.password,
      passwordToken: parsed.server.password_token,
      passwordSalt: parsed.server.password_salt,
      apiKey: parsed.server.api_key,
    }
  } catch {
    return null
  }
}

export async function saveCredentials(creds: Credentials, configDir?: string): Promise<void> {
  const dir = configDir ?? join(homedir(), '.config', '<appname>')
  await mkdir(dir, { recursive: true })
  const toml = `[server]
url = "${creds.url}"
auth_method = "${creds.authMethod}"
username = "${creds.username}"
${creds.password ? `password = "${creds.password}"` : ''}
${creds.passwordToken ? `password_token = "${creds.passwordToken}"` : ''}
${creds.passwordSalt ? `password_salt = "${creds.passwordSalt}"` : ''}
${creds.apiKey ? `api_key = "${creds.apiKey}"` : ''}
`.trim()
  await writeFile(join(dir, 'credentials.toml'), toml + '\n', { mode: 0o600 })
}
```

- [ ] **Step 5: テストを実行して合格確認**

```bash
bun test tests/unit/config.test.ts
```

Expected: 4 tests pass

- [ ] **Step 6: コミット**

```bash
git add src/config/ tests/unit/config.test.ts
git commit -m "feat: TOML config system with deep merge"
```

---

## Task 4: Key Binding System

**Files:**
- Create: `src/config/keybinds.ts`
- Create: `tests/unit/keybinds.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/keybinds.test.ts
import { describe, test, expect } from 'bun:test'
import { keyMatches, normalizeKey } from '../../src/config/keybinds'

describe('normalizeKey', () => {
  test('"return" を "return" に正規化する', () => {
    expect(normalizeKey('return')).toBe('return')
  })
  test('"enter" を "return" に正規化する（エイリアス）', () => {
    expect(normalizeKey('enter')).toBe('return')
  })
  test('"S-tab" を "S-tab" のまま返す', () => {
    expect(normalizeKey('S-tab')).toBe('S-tab')
  })
})

describe('keyMatches', () => {
  test('設定されたキーリストにマッチする', () => {
    expect(keyMatches('j', ['j', 'up'])).toBe(true)
    expect(keyMatches('up', ['j', 'up'])).toBe(true)
  })
  test('マッチしないキーは false', () => {
    expect(keyMatches('k', ['j', 'up'])).toBe(false)
  })
  test('エイリアスを通じてマッチする', () => {
    expect(keyMatches('enter', ['return'])).toBe(true)
  })
  test('大文字小文字を区別する', () => {
    expect(keyMatches('n', ['N'])).toBe(false)
    expect(keyMatches('N', ['N'])).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/unit/keybinds.test.ts
```

Expected: FAIL — `Cannot find module '../../src/config/keybinds'`

- [ ] **Step 3: src/config/keybinds.ts を実装**

```typescript
// src/config/keybinds.ts
const KEY_ALIASES: Record<string, string> = {
  enter: 'return',
  cr: 'return',
  esc: 'escape',
}

export function normalizeKey(key: string): string {
  return KEY_ALIASES[key.toLowerCase()] ?? key
}

export function keyMatches(pressed: string, configured: string[]): boolean {
  const normalized = normalizeKey(pressed)
  return configured.some(k => normalizeKey(k) === normalized)
}

export type KeybindAction = string

export function findAction(
  pressed: string,
  keybinds: Record<string, Record<string, string[]>>
): { category: string; action: string } | null {
  for (const [category, actions] of Object.entries(keybinds)) {
    for (const [action, keys] of Object.entries(actions)) {
      if (keyMatches(pressed, keys)) return { category, action }
    }
  }
  return null
}
```

- [ ] **Step 4: テストを実行して合格確認**

```bash
bun test tests/unit/keybinds.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/config/keybinds.ts tests/unit/keybinds.test.ts
git commit -m "feat: key binding system with alias support"
```

---

## Task 5: Subsonic API Client

**Files:**
- Create: `src/services/subsonic.ts`
- Create: `tests/integration/subsonic.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/integration/subsonic.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SubsonicClient } from '../../src/services/subsonic'

// モックサーバー（Bun の serve を使用）
let server: ReturnType<typeof Bun.serve>
let client: SubsonicClient

beforeAll(() => {
  server = Bun.serve({
    port: 19876,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/rest/ping') {
        return Response.json({
          'subsonic-response': { status: 'ok', version: '1.16.1' }
        })
      }
      if (url.pathname === '/rest/search3') {
        return Response.json({
          'subsonic-response': {
            status: 'ok',
            version: '1.16.1',
            searchResult3: {
              song: [{ id: '1', title: 'Test Song', artist: 'Test', album: 'Test Album', duration: 180 }],
              album: [],
              artist: [],
            }
          }
        })
      }
      return new Response('Not found', { status: 404 })
    }
  })

  client = new SubsonicClient({
    url: 'http://localhost:19876',
    authMethod: 'plaintext',
    username: 'test',
    password: 'test',
  })
})

afterAll(() => server.stop())

test('ping が成功する', async () => {
  await expect(client.ping()).resolves.not.toThrow()
})

test('search3 が Song 配列を返す', async () => {
  const result = await client.search('Test', { songCount: 10, albumCount: 0, artistCount: 0 })
  expect(result.songs).toHaveLength(1)
  expect(result.songs[0].title).toBe('Test Song')
  expect(result.songs[0].duration).toBe(180)
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/integration/subsonic.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/subsonic'`

- [ ] **Step 3: src/services/subsonic.ts を実装**

```typescript
// src/services/subsonic.ts
import { createHash } from 'node:crypto'
import type { Credentials } from '../types/config'
import type { Song, Album, Artist, Playlist, SearchResult, StructuredLyrics } from '../types/subsonic'

class SubsonicError extends Error {
  constructor(public code: number, message: string, public retryable: boolean) {
    super(message)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(e: unknown): boolean {
  if (e instanceof SubsonicError) return e.retryable
  return e instanceof TypeError  // network error
}

function parseSong(raw: any): Song {
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    artist: raw.artist ?? '',
    artistId: String(raw.artistId ?? ''),
    album: raw.album ?? '',
    albumId: String(raw.albumId ?? ''),
    duration: Number(raw.duration ?? 0),
    rating: Number(raw.userRating ?? 0),
    genre: raw.genre,
    year: raw.year ? Number(raw.year) : undefined,
    trackNumber: raw.track ? Number(raw.track) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
    path: raw.path,
    starred: !!raw.starred,
  }
}

function parseAlbum(raw: any): Album {
  return {
    id: String(raw.id),
    name: raw.name ?? raw.title ?? '',
    artist: raw.artist ?? '',
    artistId: String(raw.artistId ?? ''),
    songCount: Number(raw.songCount ?? 0),
    duration: Number(raw.duration ?? 0),
    year: raw.year ? Number(raw.year) : undefined,
    genre: raw.genre,
    rating: Number(raw.userRating ?? 0),
    starred: !!raw.starred,
    coverArt: raw.coverArt ? String(raw.coverArt) : undefined,
  }
}

function parseArtist(raw: any): Artist {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    albumCount: Number(raw.albumCount ?? 0),
    rating: Number(raw.userRating ?? 0),
    starred: !!raw.starred,
  }
}

export class SubsonicClient {
  private creds: Credentials

  constructor(creds: Credentials) {
    this.creds = creds
  }

  private buildParams(extra: Record<string, string> = {}): URLSearchParams {
    const params = new URLSearchParams({
      v: '1.16.1',
      c: '<appname>',
      f: 'json',
      u: this.creds.username,
      ...extra,
    })
    if (this.creds.authMethod === 'plaintext') {
      params.set('p', this.creds.password ?? '')
    } else if (this.creds.authMethod === 'hashed') {
      params.set('t', this.creds.passwordToken ?? '')
      params.set('s', this.creds.passwordSalt ?? '')
    } else if (this.creds.authMethod === 'api_key') {
      params.set('apiKey', this.creds.apiKey ?? '')
    }
    return params
  }

  private async request<T>(endpoint: string, extra: Record<string, string> = {}): Promise<T> {
    const params = this.buildParams(extra)
    const url = `${this.creds.url}/rest/${endpoint}?${params}`

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
        if (!res.ok) {
          throw new SubsonicError(res.status, res.statusText, attempt < 2)
        }
        const json = await res.json() as any
        const sr = json['subsonic-response']
        if (sr.status === 'failed') {
          throw new SubsonicError(sr.error.code, sr.error.message, false)
        }
        return sr as T
      } catch (e) {
        if (!isRetryable(e) || attempt === 2) throw e
        await sleep(500 * (attempt + 1))
      }
    }
    throw new Error('unreachable')
  }

  async ping(): Promise<void> {
    await this.request('ping')
  }

  async search(
    query: string,
    opts: { songCount?: number; albumCount?: number; artistCount?: number; offset?: number } = {}
  ): Promise<SearchResult> {
    const res = await this.request<any>('search3', {
      query,
      songCount: String(opts.songCount ?? 150),
      albumCount: String(opts.albumCount ?? 150),
      artistCount: String(opts.artistCount ?? 150),
      songOffset: String(opts.offset ?? 0),
    })
    const sr3 = res.searchResult3 ?? {}
    return {
      songs: (sr3.song ?? []).map(parseSong),
      albums: (sr3.album ?? []).map(parseAlbum),
      artists: (sr3.artist ?? []).map(parseArtist),
    }
  }

  async getAlbum(id: string): Promise<{ album: Album; songs: Song[] }> {
    const res = await this.request<any>('getAlbum', { id })
    return {
      album: parseAlbum(res.album),
      songs: (res.album.song ?? []).map(parseSong),
    }
  }

  async getAlbumList(
    type: 'random' | 'newest' | 'highest' | 'frequent' | 'recent' | 'starred',
    opts: { size?: number; offset?: number } = {}
  ): Promise<Album[]> {
    const res = await this.request<any>('getAlbumList2', {
      type,
      size: String(opts.size ?? 150),
      offset: String(opts.offset ?? 0),
    })
    return (res.albumList2?.album ?? []).map(parseAlbum)
  }

  async getArtist(id: string): Promise<{ artist: Artist; albums: Album[] }> {
    const res = await this.request<any>('getArtist', { id })
    return {
      artist: parseArtist(res.artist),
      albums: (res.artist.album ?? []).map(parseAlbum),
    }
  }

  async getPlaylists(): Promise<Playlist[]> {
    const res = await this.request<any>('getPlaylists')
    return (res.playlists?.playlist ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      songCount: p.songCount,
    }))
  }

  async getPlaylist(id: string): Promise<{ playlist: Playlist; songs: Song[] }> {
    const res = await this.request<any>('getPlaylist', { id })
    return {
      playlist: { id: String(res.playlist.id), name: res.playlist.name },
      songs: (res.playlist.entry ?? []).map(parseSong),
    }
  }

  async getStarred(): Promise<{ songs: Song[]; albums: Album[]; artists: Artist[] }> {
    const res = await this.request<any>('getStarred2')
    return {
      songs: (res.starred2?.song ?? []).map(parseSong),
      albums: (res.starred2?.album ?? []).map(parseAlbum),
      artists: (res.starred2?.artist ?? []).map(parseArtist),
    }
  }

  async star(id: string, type: 'song' | 'album' | 'artist'): Promise<void> {
    const key = type === 'song' ? 'id' : type === 'album' ? 'albumId' : 'artistId'
    await this.request('star', { [key]: id }).catch(() => {})
  }

  async unstar(id: string, type: 'song' | 'album' | 'artist'): Promise<void> {
    const key = type === 'song' ? 'id' : type === 'album' ? 'albumId' : 'artistId'
    await this.request('unstar', { [key]: id }).catch(() => {})
  }

  async setRating(id: string, rating: number): Promise<void> {
    await this.request('setRating', { id, rating: String(rating) }).catch(() => {})
  }

  async scrobble(id: string, opts: { submission: boolean; time?: number }): Promise<void> {
    const extra: Record<string, string> = { id, submission: String(opts.submission) }
    if (opts.time) extra.time = String(opts.time)
    await this.request('scrobble', extra).catch(() => {})
  }

  async getLyrics(songId: string): Promise<StructuredLyrics | null> {
    try {
      const res = await this.request<any>('getLyricsBySongId', { id: songId })
      const lyrics = res.lyricsList?.structuredLyrics?.[0]
      if (!lyrics) return null
      return {
        synced: !!lyrics.synced,
        lines: (lyrics.line ?? []).map((l: any) => ({
          start: Number(l.start ?? 0),
          value: String(l.value ?? ''),
        })),
      }
    } catch {
      return null
    }
  }

  streamUrl(id: string): string {
    const params = this.buildParams({ id, maxBitRate: '0', _nonce: String(Date.now()) })
    return `${this.creds.url}/rest/stream?${params}`
  }

  coverArtUrl(id: string, size = 300): string {
    const params = this.buildParams({ id, size: String(size) })
    return `${this.creds.url}/rest/getCoverArt?${params}`
  }

  async savePlayQueue(songIds: string[], current: string, position: number): Promise<void> {
    const extra: Record<string, string> = { current, position: String(Math.floor(position)) }
    await this.request('savePlayQueue', { ...extra, id: songIds.join(',') }).catch(() => {})
  }

  async getPlayQueue(): Promise<{ currentId: string; songs: Song[] } | null> {
    try {
      const res = await this.request<any>('getPlayQueue')
      if (!res.playQueue) return null
      return {
        currentId: String(res.playQueue.current ?? ''),
        songs: (res.playQueue.entry ?? []).map(parseSong),
      }
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: テストを実行して合格確認**

```bash
bun test tests/integration/subsonic.test.ts
```

Expected: 2 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/services/subsonic.ts tests/integration/subsonic.test.ts
git commit -m "feat: Subsonic API client with retry and all endpoints"
```

---

## Task 6: Scrobble Service

**Files:**
- Create: `src/services/scrobble.ts`
- Create: `tests/unit/scrobble.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/scrobble.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { ScrobbleService } from '../../src/services/scrobble'
import type { Song } from '../../src/types/subsonic'

const makeSong = (duration: number): Song => ({
  id: 'song-1',
  title: 'Test',
  artist: 'Artist',
  artistId: 'a1',
  album: 'Album',
  albumId: 'al1',
  duration,
  rating: 0,
})

describe('ScrobbleService', () => {
  let scrobbleFn: ReturnType<typeof mock>
  let service: ScrobbleService

  beforeEach(() => {
    scrobbleFn = mock(() => Promise.resolve())
    service = new ScrobbleService(scrobbleFn as any)
  })

  test('30秒未満の曲はスクロブルリクエストを送らない', async () => {
    service.onSongStart(makeSong(20))
    expect(scrobbleFn).not.toHaveBeenCalled()
  })

  test('曲開始時に submission=false を即時送信する', async () => {
    service.onSongStart(makeSong(300))
    expect(scrobbleFn).toHaveBeenCalledTimes(1)
    expect(scrobbleFn).toHaveBeenCalledWith('song-1', { submission: false })
  })

  test('スキップ時はタイマーをキャンセルして completion を送らない', async () => {
    using timers = Bun.jest.useFakeTimers()
    service.onSongStart(makeSong(300))
    service.onSongSkip()
    timers.advanceTimersByTime(200_000)
    // submission=false（Now Playing）の1回のみ
    expect(scrobbleFn).toHaveBeenCalledTimes(1)
  })

  test('新曲開始で前の曲のタイマーをキャンセルする', async () => {
    using timers = Bun.jest.useFakeTimers()
    service.onSongStart(makeSong(300))
    service.onSongStart(makeSong(300))
    timers.advanceTimersByTime(200_000)
    // 各曲の submission=false 2回のみ（完了スクロブルなし）
    expect(scrobbleFn).toHaveBeenCalledTimes(2)
    const calls = scrobbleFn.mock.calls
    expect(calls[0][1]).toEqual({ submission: false })
    expect(calls[1][1]).toEqual({ submission: false })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/unit/scrobble.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/scrobble'`

- [ ] **Step 3: src/services/scrobble.ts を実装**

```typescript
// src/services/scrobble.ts
import type { Song } from '../types/subsonic'
import type { SubsonicClient } from './subsonic'

type ScrobbleFn = SubsonicClient['scrobble']

export class ScrobbleService {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly scrobble: ScrobbleFn) {}

  onSongStart(song: Song): void {
    this.cancelPending()

    if (song.duration < 30) return

    const startedAt = Date.now()

    // ① Now Playing 即時通知
    this.scrobble(song.id, { submission: false })

    // ② 完了スクロブル（Last.fm 標準: 50% または 240秒の早い方）
    const thresholdMs = Math.min(song.duration * 0.5, 240) * 1000
    this.timer = setTimeout(() => {
      this.scrobble(song.id, { submission: true, time: startedAt })
    }, thresholdMs)
  }

  onSongSkip(): void {
    this.cancelPending()
  }

  destroy(): void {
    this.cancelPending()
  }

  private cancelPending(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
```

- [ ] **Step 4: テストを実行して合格確認**

```bash
bun test tests/unit/scrobble.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/services/scrobble.ts tests/unit/scrobble.test.ts
git commit -m "feat: scrobble service with correct Now Playing and completion timing"
```

---

## Task 7: MPV IPC Client

**Files:**
- Create: `src/services/mpv.ts`

- [ ] **Step 1: src/services/mpv.ts を実装**

MPV の Unix ソケット IPC は JSON-RPC スタイルなので、リクエスト/レスポンスのマッチングが必要。

```typescript
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
    this.socketPath = socketPath ?? `/tmp/<appname>_mpv_${uid}.sock`
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
    ], { stdout: 'ignore', stderr: 'ignore' })

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
```

- [ ] **Step 2: MPV がインストールされているか確認**

```bash
which mpv
```

Expected: `/usr/local/bin/mpv` などのパスが表示される。なければ `brew install mpv` でインストール。

- [ ] **Step 3: 手動動作確認**

```typescript
// 一時ファイル: test-mpv.ts
import { MpvClient } from './src/services/mpv'
const mpv = new MpvClient()
await mpv.spawn()
console.log('MPV spawned')
const status = await mpv.getStatus()
console.log('Status:', status)
await mpv.quit()
console.log('Done')
```

```bash
bun run test-mpv.ts && rm test-mpv.ts
```

Expected: `Status: { paused: true, position: 0, duration: 0, volume: 80, path: null }` などが表示される。

- [ ] **Step 4: コミット**

```bash
git add src/services/mpv.ts
git commit -m "feat: MPV IPC client with socket communication"
```

---

## Task 8: Image Service

**Files:**
- Create: `src/services/image.ts`
- Create: `tests/unit/image.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/image.test.ts
import { describe, test, expect } from 'bun:test'
import { detectProtocol, renderBlocks } from '../../src/services/image'

describe('detectProtocol', () => {
  test('TERM_PROGRAM=WezTerm → kitty', () => {
    const orig = process.env.TERM_PROGRAM
    process.env.TERM_PROGRAM = 'WezTerm'
    expect(detectProtocol()).toBe('kitty')
    process.env.TERM_PROGRAM = orig
  })

  test('TERM_PROGRAM=iTerm.app → iterm2', () => {
    const orig = process.env.TERM_PROGRAM
    process.env.TERM_PROGRAM = 'iTerm.app'
    expect(detectProtocol()).toBe('iterm2')
    process.env.TERM_PROGRAM = orig
  })

  test('未知のターミナル → blocks', () => {
    const origProg = process.env.TERM_PROGRAM
    const origTerm = process.env.TERM
    process.env.TERM_PROGRAM = 'unknown'
    process.env.TERM = 'xterm'
    expect(detectProtocol()).toBe('blocks')
    process.env.TERM_PROGRAM = origProg
    process.env.TERM = origTerm
  })
})

describe('renderBlocks', () => {
  test('2x2 ピクセルの RGBA バッファからブロック文字を生成する', () => {
    // 4ピクセル: 白・黒・白・黒（RGBA各4バイト）
    const pixels = Buffer.from([
      255, 255, 255, 255,  // 白
      0, 0, 0, 255,        // 黒
      255, 255, 255, 255,  // 白
      0, 0, 0, 255,        // 黒
    ])
    const result = renderBlocks(pixels, 2, 2)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/unit/image.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/image'`

- [ ] **Step 3: src/services/image.ts を実装**

```typescript
// src/services/image.ts
import { LRUCache } from 'lru-cache'
import Jimp from 'jimp'

export type ImageProtocol = 'kitty' | 'iterm2' | 'sixel' | 'blocks'

export function detectProtocol(): ImageProtocol {
  const term = process.env.TERM_PROGRAM ?? ''
  const termName = process.env.TERM ?? ''
  if (term === 'WezTerm') return 'kitty'
  if (term === 'iTerm.app') return 'iterm2'
  if (term === 'ghostty') return 'kitty'
  if (termName.includes('kitty')) return 'kitty'
  return 'blocks'
}

// RGBA ピクセルバッファから上下ハーフブロック文字列を生成
export function renderBlocks(pixels: Buffer, width: number, height: number): string {
  let out = ''
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const topIdx = (y * width + x) * 4
      const botIdx = ((y + 1) * width + x) * 4
      const tr = pixels[topIdx], tg = pixels[topIdx + 1], tb = pixels[topIdx + 2]
      const br = y + 1 < height ? pixels[botIdx] : 0
      const bg = y + 1 < height ? pixels[botIdx + 1] : 0
      const bb = y + 1 < height ? pixels[botIdx + 2] : 0
      out += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀`
    }
    out += '\x1b[0m\n'
  }
  return out
}

function renderKitty(imageData: Buffer, width: number, height: number): string {
  const b64 = imageData.toString('base64')
  const chunkSize = 4096
  let result = ''
  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize)
    const isFirst = i === 0
    const isLast = i + chunkSize >= b64.length
    const m = isLast ? 0 : 1
    if (isFirst) {
      result += `\x1b_Ga=T,f=32,s=${width},v=${height},m=${m};${chunk}\x1b\\`
    } else {
      result += `\x1b_Gm=${m};${chunk}\x1b\\`
    }
  }
  return result
}

function renderIterm2(imageData: Buffer): string {
  const b64 = imageData.toString('base64')
  return `\x1b]1337;File=inline=1:${b64}\x07`
}

const cache = new LRUCache<string, Buffer>({ max: 20 })

export async function fetchAndRender(
  coverArtUrl: string,
  pixelSize: number,
  protocol: ImageProtocol
): Promise<string> {
  const cacheKey = `${coverArtUrl}:${pixelSize}:${protocol}`
  const cached = cache.get(cacheKey)

  let imageBuffer: Buffer
  if (cached) {
    imageBuffer = cached
  } else {
    const res = await fetch(coverArtUrl)
    if (!res.ok) return ''
    const raw = Buffer.from(await res.arrayBuffer())
    const img = await Jimp.fromBuffer(raw)
    img.resize({ w: pixelSize, h: pixelSize })

    if (protocol === 'kitty') {
      // RGBA raw pixels for Kitty
      imageBuffer = img.bitmap.data as Buffer
    } else {
      // PNG for iTerm2
      imageBuffer = await img.getBuffer('image/png')
    }
    cache.set(cacheKey, imageBuffer)
  }

  if (protocol === 'kitty') {
    return renderKitty(imageBuffer, pixelSize, pixelSize)
  } else if (protocol === 'iterm2') {
    return renderIterm2(imageBuffer)
  } else {
    // blocks: re-fetch for RGBA
    const res = await fetch(coverArtUrl)
    const raw = Buffer.from(await res.arrayBuffer())
    const img = await Jimp.fromBuffer(raw)
    img.resize({ w: pixelSize, h: pixelSize * 2 }) // 2:1 aspect for half-block chars
    return renderBlocks(img.bitmap.data as Buffer, pixelSize, pixelSize * 2)
  }
}
```

- [ ] **Step 4: テストを実行して合格確認**

```bash
bun test tests/unit/image.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/services/image.ts tests/unit/image.test.ts
git commit -m "feat: image service with Kitty/iTerm2/blocks protocol support"
```

---

## Task 9: Notify Service

**Files:**
- Create: `src/services/notify.ts`

- [ ] **Step 1: src/services/notify.ts を実装**

```typescript
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
```

- [ ] **Step 2: コミット**

```bash
git add src/services/notify.ts
git commit -m "feat: desktop notification service (macOS/Linux)"
```

---

## Task 10: Zustand Stores

**Files:**
- Create: `src/stores/player.store.ts`
- Create: `src/stores/queue.store.ts`
- Create: `src/stores/library.store.ts`
- Create: `src/stores/ui.store.ts`
- Create: `tests/unit/queue.test.ts`

- [ ] **Step 1: queue.store のテストを書く**

```typescript
// tests/unit/queue.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { useQueueStore } from '../../src/stores/queue.store'
import type { Song } from '../../src/types/subsonic'

const makeSong = (id: string): Song => ({
  id, title: `Song ${id}`, artist: 'A', artistId: 'a',
  album: 'B', albumId: 'b', duration: 180, rating: 0,
})

describe('QueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ items: [], currentIndex: -1 })
  })

  test('enqueueLast で末尾に追加される', () => {
    useQueueStore.getState().enqueueLast(makeSong('1'))
    useQueueStore.getState().enqueueLast(makeSong('2'))
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '2'])
  })

  test('enqueueNext で currentIndex の直後に挿入される', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().enqueueNext(makeSong('2'))
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '2', '3'])
  })

  test('next() で currentIndex が進む', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2')], currentIndex: 0 })
    const song = useQueueStore.getState().next()
    expect(song?.id).toBe('2')
    expect(useQueueStore.getState().currentIndex).toBe(1)
  })

  test('clear() で items が空になり currentIndex が -1 になる', () => {
    useQueueStore.setState({ items: [makeSong('1')], currentIndex: 0 })
    useQueueStore.getState().clear()
    expect(useQueueStore.getState().items).toHaveLength(0)
    expect(useQueueStore.getState().currentIndex).toBe(-1)
  })

  test('remove() で指定インデックスの曲が削除される', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().remove(1)
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '3'])
  })

  test('moveUp() でアイテムを1つ上に移動する', () => {
    useQueueStore.setState({ items: [makeSong('1'), makeSong('2'), makeSong('3')], currentIndex: 0 })
    useQueueStore.getState().moveUp(2)
    expect(useQueueStore.getState().items.map(s => s.id)).toEqual(['1', '3', '2'])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
bun test tests/unit/queue.test.ts
```

Expected: FAIL — `Cannot find module '../../src/stores/queue.store'`

- [ ] **Step 3: src/stores/queue.store.ts を実装**

```typescript
// src/stores/queue.store.ts
import { create } from 'zustand'
import type { Song } from '../types/subsonic'

type QueueState = {
  items: Song[]
  currentIndex: number
  enqueueLast: (song: Song) => void
  enqueueNext: (song: Song) => void
  remove: (index: number) => void
  clear: () => void
  moveUp: (index: number) => void
  moveDown: (index: number) => void
  next: () => Song | null
  prev: () => Song | null
  setCurrentIndex: (index: number) => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  currentIndex: -1,

  enqueueLast: (song) => set(s => ({ items: [...s.items, song] })),

  enqueueNext: (song) => set(s => {
    const idx = s.currentIndex
    const items = [...s.items]
    items.splice(idx + 1, 0, song)
    return { items }
  }),

  remove: (index) => set(s => {
    const items = s.items.filter((_, i) => i !== index)
    const currentIndex = index < s.currentIndex
      ? s.currentIndex - 1
      : index === s.currentIndex ? -1 : s.currentIndex
    return { items, currentIndex }
  }),

  clear: () => set({ items: [], currentIndex: -1 }),

  moveUp: (index) => set(s => {
    if (index <= 0) return s
    const items = [...s.items]
    ;[items[index - 1], items[index]] = [items[index], items[index - 1]]
    return { items }
  }),

  moveDown: (index) => set(s => {
    if (index >= s.items.length - 1) return s
    const items = [...s.items]
    ;[items[index], items[index + 1]] = [items[index + 1], items[index]]
    return { items }
  }),

  next: () => {
    const { items, currentIndex } = get()
    const nextIdx = currentIndex + 1
    if (nextIdx >= items.length) return null
    set({ currentIndex: nextIdx })
    return items[nextIdx]
  },

  prev: () => {
    const { items, currentIndex } = get()
    const prevIdx = currentIndex - 1
    if (prevIdx < 0) return null
    set({ currentIndex: prevIdx })
    return items[prevIdx]
  },

  setCurrentIndex: (index) => set({ currentIndex: index }),
}))
```

- [ ] **Step 4: テストを実行して合格確認**

```bash
bun test tests/unit/queue.test.ts
```

Expected: 7 tests pass

- [ ] **Step 5: 残りの3つのストアを実装**

```typescript
// src/stores/player.store.ts
import { create } from 'zustand'
import type { Song } from '../types/subsonic'
import type { PlaybackStatus, LoopMode, MpvStatus } from '../types/player'

type PlayerState = {
  status: PlaybackStatus
  currentSong: Song | null
  position: number
  duration: number
  volume: number
  loopMode: LoopMode
  error: string | null
  syncFromMpv: (status: MpvStatus) => void
  setCurrentSong: (song: Song | null) => void
  setVolume: (v: number) => void
  setLoopMode: (m: LoopMode) => void
  setError: (msg: string | null) => void
  nextLoopMode: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  status: 'stopped',
  currentSong: null,
  position: 0,
  duration: 0,
  volume: 80,
  loopMode: 'none',
  error: null,

  syncFromMpv: (mpv) => set({
    status: mpv.paused ? 'paused' : mpv.path ? 'playing' : 'stopped',
    position: mpv.position,
    duration: mpv.duration,
    volume: mpv.volume,
  }),

  setCurrentSong: (song) => set({ currentSong: song }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(100, v)) }),
  setLoopMode: (m) => set({ loopMode: m }),
  setError: (msg) => set({ error: msg }),

  nextLoopMode: () => {
    const order: LoopMode[] = ['none', 'all', 'one']
    const cur = get().loopMode
    const next = order[(order.indexOf(cur) + 1) % order.length]
    set({ loopMode: next })
  },
}))
```

```typescript
// src/stores/library.store.ts
import { create } from 'zustand'
import type { Song, Album, Artist, Playlist } from '../types/subsonic'

export type LibraryView = 'songs' | 'albums' | 'artists' | 'playlists' | 'starred'

type LibraryState = {
  view: LibraryView
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  playlists: Playlist[]
  cursor: number
  pageOffset: number
  isLoading: boolean
  hasMore: boolean
  setView: (v: LibraryView) => void
  setItems: (type: 'songs' | 'albums' | 'artists' | 'playlists', items: any[]) => void
  appendItems: (type: 'songs' | 'albums' | 'artists', items: any[]) => void
  setCursor: (c: number) => void
  moveCursor: (delta: number) => void
  setLoading: (v: boolean) => void
  setHasMore: (v: boolean) => void
  setPageOffset: (v: number) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  view: 'songs',
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
  cursor: 0,
  pageOffset: 0,
  isLoading: false,
  hasMore: false,

  setView: (v) => set({ view: v, cursor: 0, pageOffset: 0 }),

  setItems: (type, items) => set({ [type]: items, cursor: 0, pageOffset: 0 }),

  appendItems: (type, items) => set(s => ({ [type]: [...(s as any)[type], ...items] })),

  setCursor: (c) => set({ cursor: c }),

  moveCursor: (delta) => set(s => {
    const list = s.view === 'albums' ? s.albums
      : s.view === 'artists' ? s.artists
      : s.view === 'playlists' ? s.playlists
      : s.songs
    const max = list.length - 1
    return { cursor: Math.max(0, Math.min(max, s.cursor + delta)) }
  }),

  setLoading: (v) => set({ isLoading: v }),
  setHasMore: (v) => set({ hasMore: v }),
  setPageOffset: (v) => set({ pageOffset: v }),
}))
```

```typescript
// src/stores/ui.store.ts
import { create } from 'zustand'

export type ActiveTab = 'library' | 'queue' | 'search' | 'settings'
export type SearchFilter = 'songs' | 'albums' | 'artists'

type UiState = {
  activeTab: ActiveTab
  showNowPlaying: boolean
  showHelp: boolean
  showPlaylists: boolean
  showLogin: boolean
  searchQuery: string
  searchFilter: SearchFilter
  statusMessage: string | null
  setTab: (t: ActiveTab) => void
  nextTab: () => void
  prevTab: () => void
  toggleNowPlaying: () => void
  toggleHelp: () => void
  setShowLogin: (v: boolean) => void
  setSearchQuery: (q: string) => void
  setSearchFilter: (f: SearchFilter) => void
  setStatusMessage: (msg: string | null) => void
}

const TAB_ORDER: ActiveTab[] = ['library', 'queue', 'search', 'settings']

export const useUiStore = create<UiState>((set, get) => ({
  activeTab: 'library',
  showNowPlaying: false,
  showHelp: false,
  showPlaylists: false,
  showLogin: false,
  searchQuery: '',
  searchFilter: 'songs',
  statusMessage: null,

  setTab: (t) => set({ activeTab: t }),

  nextTab: () => set(s => {
    const i = TAB_ORDER.indexOf(s.activeTab)
    return { activeTab: TAB_ORDER[(i + 1) % TAB_ORDER.length] }
  }),

  prevTab: () => set(s => {
    const i = TAB_ORDER.indexOf(s.activeTab)
    return { activeTab: TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length] }
  }),

  toggleNowPlaying: () => set(s => ({ showNowPlaying: !s.showNowPlaying })),
  toggleHelp: () => set(s => ({ showHelp: !s.showHelp })),
  setShowLogin: (v) => set({ showLogin: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchFilter: (f) => set({ searchFilter: f }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
}))
```

- [ ] **Step 6: テストを実行して合格確認**

```bash
bun test tests/unit/queue.test.ts
```

Expected: 7 tests pass（新ストアはロジックシンプルなので queue のテストで代表）

- [ ] **Step 7: コミット**

```bash
git add src/stores/
git commit -m "feat: Zustand stores (player, queue, library, ui)"
```

---

## Task 11: Hooks

**Files:**
- Create: `src/hooks/useMpvSync.ts`
- Create: `src/hooks/useKeyHandler.ts`

- [ ] **Step 1: src/hooks/useMpvSync.ts を実装**

```typescript
// src/hooks/useMpvSync.ts
import { useEffect, useRef } from 'react'
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
```

- [ ] **Step 2: src/hooks/useKeyHandler.ts を実装**

`Z Z` のダブルタップ検出ロジックを含む。

```typescript
// src/hooks/useKeyHandler.ts
import { useInput } from 'ink'
import { useRef } from 'react'
import { findAction } from '../config/keybinds'
import type { AppConfig } from '../types/config'

type Handler = (category: string, action: string) => void

export function useKeyHandler(config: AppConfig, onAction: Handler) {
  const lastZRef = useRef<number>(0)

  useInput((input, key) => {
    // キーを正規化
    let pressed = input
    if (key.return) pressed = 'return'
    else if (key.escape) pressed = 'escape'
    else if (key.tab) pressed = key.shift ? 'S-tab' : 'tab'
    else if (key.upArrow) pressed = 'up'
    else if (key.downArrow) pressed = 'down'
    else if (key.leftArrow) pressed = 'left'
    else if (key.rightArrow) pressed = 'right'
    else if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    // Z Z ダブルタップ検出（300ms以内）
    if (pressed === 'Z') {
      const now = Date.now()
      if (now - lastZRef.current < 300) {
        onAction('global', 'quit')
        return
      }
      lastZRef.current = now
      return
    }

    const action = findAction(pressed, config.keybinds)
    if (action) onAction(action.category, action.action)
  })
}
```

- [ ] **Step 3: コミット**

```bash
git add src/hooks/
git commit -m "feat: useMpvSync and useKeyHandler hooks"
```

---

## Task 12: Shared UI Components

**Files:**
- Create: `src/components/shared/ProgressBar.tsx`
- Create: `src/components/shared/SongTable.tsx`
- Create: `src/components/shared/AlbumArt.tsx`

- [ ] **Step 1: src/components/shared/ProgressBar.tsx を実装**

```tsx
// src/components/shared/ProgressBar.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  position: number   // 秒
  duration: number   // 秒
  width: number      // 文字数
  color?: string
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ProgressBar({ position, duration, width, color = '#7dd3fc' }: Props) {
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0
  const filled = Math.floor(ratio * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return (
    <Box gap={1}>
      <Text color={color}>{bar}</Text>
      <Text color="#6b7280">{formatTime(position)}/{formatTime(duration)}</Text>
    </Box>
  )
}
```

- [ ] **Step 2: src/components/shared/SongTable.tsx を実装**

```tsx
// src/components/shared/SongTable.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Song } from '../../types/subsonic'
import type { ColumnsConfig } from '../../types/config'

type Props = {
  songs: Song[]
  cursor: number
  currentSongId?: string
  columns: ColumnsConfig
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len)
}

function ratingStr(r: number): string {
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SongTable({ songs, cursor, currentSongId, columns, highlight, subtle }: Props) {
  return (
    <Box flexDirection="column">
      {songs.map((song, i) => {
        const isPlaying = song.id === currentSongId
        const isSelected = i === cursor
        const color = isPlaying ? highlight : isSelected ? '#ffffff' : subtle
        const bg = isSelected && !isPlaying ? '#1e293b' : undefined

        return (
          <Box key={song.id} backgroundColor={bg}>
            <Text color={isPlaying ? highlight : subtle}>{isPlaying ? '▶ ' : '  '}</Text>
            {columns.trackNumber && <Text color={color}>{String(song.trackNumber ?? '').padStart(2)} </Text>}
            {columns.title && <Text color={color}>{truncate(song.title, 28)}</Text>}
            {columns.artist && <Text color={color}> {truncate(song.artist, 18)}</Text>}
            {columns.album && <Text color={color}> {truncate(song.album, 18)}</Text>}
            {columns.year && <Text color={color}> {String(song.year ?? '').padStart(4)}</Text>}
            {columns.rating && <Text color={color}> {ratingStr(song.rating)}</Text>}
            {columns.duration && <Text color={color}> {fmtDuration(song.duration)}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 3: src/components/shared/AlbumArt.tsx を実装**

```tsx
// src/components/shared/AlbumArt.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { fetchAndRender, detectProtocol } from '../../services/image'

const PROTOCOL = detectProtocol()

type Props = {
  coverArtUrl: string | null
  pixelSize: number
}

export function AlbumArt({ coverArtUrl, pixelSize }: Props) {
  const [rendered, setRendered] = useState<string | null>(null)

  useEffect(() => {
    if (!coverArtUrl) { setRendered(null); return }
    let cancelled = false
    fetchAndRender(coverArtUrl, pixelSize, PROTOCOL).then(r => {
      if (!cancelled) setRendered(r)
    }).catch(() => setRendered(null))
    return () => { cancelled = true }
  }, [coverArtUrl, pixelSize])

  if (!rendered) {
    return <Box width={Math.ceil(pixelSize / 2)} height={Math.ceil(pixelSize / 4)}><Text>🎵</Text></Box>
  }

  // ANSI/Kitty エスケープシーケンスをそのまま出力
  return <Text>{rendered}</Text>
}
```

- [ ] **Step 4: コミット**

```bash
git add src/components/shared/
git commit -m "feat: shared UI components (ProgressBar, SongTable, AlbumArt)"
```

---

## Task 13: Layout Components

**Files:**
- Create: `src/components/layout/TabBar.tsx`
- Create: `src/components/layout/PlayerBar.tsx`
- Create: `src/components/layout/NowPlayingOverlay.tsx`

- [ ] **Step 1: src/components/layout/TabBar.tsx を実装**

```tsx
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
```

- [ ] **Step 2: src/components/layout/PlayerBar.tsx を実装**

```tsx
// src/components/layout/PlayerBar.tsx
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { ProgressBar } from '../shared/ProgressBar'
import { AlbumArt } from '../shared/AlbumArt'
import { usePlayerStore } from '../../stores/player.store'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient | null
}

function loopIcon(mode: string) {
  if (mode === 'all') return '🔁'
  if (mode === 'one') return '🔂'
  return '  '
}

export function PlayerBar({ config, subsonic }: Props) {
  const { status, currentSong, position, duration, volume, loopMode } = usePlayerStore()
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80
  const barWidth = Math.max(10, termWidth - 60)

  const coverArtUrl = currentSong && subsonic
    ? subsonic.coverArtUrl(currentSong.albumId, 32)
    : null

  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor="#334155"
      paddingX={1}
      gap={1}
    >
      <AlbumArt coverArtUrl={coverArtUrl} pixelSize={32} />
      <Text color={status === 'playing' ? config.theme.highlight : config.theme.subtle}>
        {status === 'playing' ? '▶' : status === 'paused' ? '⏸' : '⏹'}
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text color={config.theme.highlight}>
          {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'No track'}
        </Text>
        <Box gap={1}>
          <ProgressBar position={position} duration={duration} width={barWidth} color={config.theme.highlight} />
          <Text color={config.theme.subtle}>{loopIcon(loopMode)} 🔊{Math.round(volume)}</Text>
        </Box>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: src/components/layout/NowPlayingOverlay.tsx を実装**

```tsx
// src/components/layout/NowPlayingOverlay.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { AlbumArt } from '../shared/AlbumArt'
import { ProgressBar } from '../shared/ProgressBar'
import { usePlayerStore } from '../../stores/player.store'
import type { SubsonicClient } from '../../services/subsonic'
import type { StructuredLyrics } from '../../types/subsonic'
import type { AppConfig } from '../../types/config'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient | null
}

export function NowPlayingOverlay({ config, subsonic }: Props) {
  const { currentSong, position, duration, volume, loopMode, status } = usePlayerStore()
  const [lyrics, setLyrics] = useState<StructuredLyrics | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80

  useEffect(() => {
    if (!currentSong || !subsonic) { setLyrics(null); return }
    subsonic.getLyrics(currentSong.id).then(setLyrics).catch(() => setLyrics(null))
  }, [currentSong?.id])

  const coverArtUrl = currentSong && subsonic
    ? subsonic.coverArtUrl(currentSong.albumId, 300)
    : null

  const artSize = Math.min(Math.floor(termWidth * 0.3), 300)

  // 現在の歌詞行（ポジションと一番近い行）
  const currentLine = lyrics?.synced
    ? [...(lyrics.lines ?? [])].reverse().find(l => l.start / 1000 <= position)?.value
    : null

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={config.theme.highlight}
      padding={1}
    >
      <Text color={config.theme.highlight} bold> Now Playing</Text>
      <Box gap={2} marginTop={1}>
        <AlbumArt coverArtUrl={coverArtUrl} pixelSize={artSize} />
        <Box flexDirection="column" flexGrow={1} gap={1}>
          <Text color="#ffffff" bold>{currentSong?.title ?? '—'}</Text>
          <Text color={config.theme.subtle}>{currentSong?.artist}</Text>
          <Text color={config.theme.subtle}>{currentSong?.album}{currentSong?.year ? ` (${currentSong.year})` : ''}</Text>
          <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
          <Text color={config.theme.subtle}>
            {'★'.repeat(currentSong?.rating ?? 0)}{'☆'.repeat(5 - (currentSong?.rating ?? 0))}
            {currentSong?.starred ? '  ♥' : ''}
          </Text>
          {currentLine && (
            <Box marginTop={1} borderStyle="single" borderColor={config.theme.subtle} padding={1}>
              <Text color={config.theme.highlight} italic>{currentLine}</Text>
            </Box>
          )}
          {lyrics && !lyrics.synced && (
            <Box marginTop={1} flexDirection="column">
              {lyrics.lines.slice(0, 10).map((l, i) => (
                <Text key={i} color={config.theme.subtle}>{l.value}</Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <Text color={config.theme.subtle} dimColor> Press M to close</Text>
    </Box>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add src/components/layout/
git commit -m "feat: layout components (TabBar, PlayerBar, NowPlayingOverlay)"
```

---

## Task 14: Library Screen

**Files:**
- Create: `src/components/screens/LibraryScreen.tsx`

- [ ] **Step 1: src/components/screens/LibraryScreen.tsx を実装**

```tsx
// src/components/screens/LibraryScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { SongTable } from '../shared/SongTable'
import { useLibraryStore, type LibraryView } from '../../stores/library.store'
import { useQueueStore } from '../../stores/queue.store'
import { usePlayerStore } from '../../stores/player.store'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'
import type { MpvClient } from '../../services/mpv'
import type { ScrobbleService } from '../../services/scrobble'

type Props = {
  config: AppConfig
  subsonic: SubsonicClient
  mpv: MpvClient
  scrobble: ScrobbleService
}

const VIEW_LABELS: Record<LibraryView, string> = {
  songs: 'All Songs',
  albums: 'Albums',
  artists: 'Artists',
  playlists: 'Playlists',
  starred: 'Starred ★',
}

const VIEWS: LibraryView[] = ['songs', 'albums', 'artists', 'playlists', 'starred']

export function LibraryScreen({ config, subsonic, mpv, scrobble }: Props) {
  const { view, songs, albums, artists, cursor, isLoading, hasMore, setView, setItems, appendItems, setLoading, setHasMore, setPageOffset, pageOffset } = useLibraryStore()
  const { enqueueLast, setCurrentIndex, items: queueItems } = useQueueStore()
  const { setCurrentSong } = usePlayerStore()

  // 初期ロード
  useEffect(() => {
    if (view === 'songs' && songs.length === 0) loadSongs(0)
    if (view === 'albums' && albums.length === 0) loadAlbums(0)
    if (view === 'artists' && artists.length === 0) loadArtists(0)
    if (view === 'starred') loadStarred()
  }, [view])

  async function loadSongs(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.search('', { songCount: 150, albumCount: 0, artistCount: 0, offset })
      if (offset === 0) setItems('songs', result.songs)
      else appendItems('songs', result.songs)
      setHasMore(result.songs.length === 150)
      setPageOffset(offset + result.songs.length)
    } finally {
      setLoading(false)
    }
  }

  async function loadAlbums(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.getAlbumList('newest', { offset })
      if (offset === 0) setItems('albums', result)
      else appendItems('albums', result)
      setHasMore(result.length === 150)
    } finally {
      setLoading(false)
    }
  }

  async function loadArtists(offset: number) {
    setLoading(true)
    try {
      const result = await subsonic.search('', { songCount: 0, albumCount: 0, artistCount: 150, offset })
      if (offset === 0) setItems('artists', result.artists)
      else appendItems('artists', result.artists)
      setHasMore(result.artists.length === 150)
    } finally {
      setLoading(false)
    }
  }

  async function loadStarred() {
    setLoading(true)
    try {
      const result = await subsonic.getStarred()
      setItems('songs', result.songs)
    } finally {
      setLoading(false)
    }
  }

  async function playSong(index: number) {
    const song = songs[index]
    if (!song) return
    const url = subsonic.streamUrl(song.id)
    await mpv.loadFile(url)
    setCurrentSong(song)
    scrobble.onSongStart(song)
    // 残りをキューに追加
    const remaining = songs.slice(index + 1)
    remaining.forEach(s => enqueueLast(s))
    setCurrentIndex(0)
  }

  const currentItems = view === 'albums' ? albums
    : view === 'artists' ? artists
    : songs

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* サブナビゲーション */}
      <Box gap={2} marginBottom={1}>
        {VIEWS.map(v => (
          <Text
            key={v}
            color={v === view ? config.theme.highlight : config.theme.subtle}
            underline={v === view}
          >
            {VIEW_LABELS[v]}
          </Text>
        ))}
      </Box>

      {/* コンテンツ */}
      {isLoading && currentItems.length === 0 ? (
        <Text color={config.theme.subtle}>Loading...</Text>
      ) : view === 'songs' || view === 'starred' ? (
        <SongTable
          songs={songs}
          cursor={cursor}
          columns={config.columns.songs}
          highlight={config.theme.highlight}
          subtle={config.theme.subtle}
        />
      ) : view === 'albums' ? (
        <Box flexDirection="column">
          {albums.map((a, i) => (
            <Box key={a.id}>
              <Text color={i === cursor ? config.theme.highlight : config.theme.subtle}>
                {i === cursor ? '▶ ' : '  '}{a.name} — {a.artist} ({a.year ?? '?'})
              </Text>
            </Box>
          ))}
        </Box>
      ) : view === 'artists' ? (
        <Box flexDirection="column">
          {artists.map((a, i) => (
            <Box key={a.id}>
              <Text color={i === cursor ? config.theme.highlight : config.theme.subtle}>
                {i === cursor ? '▶ ' : '  '}{a.name} ({a.albumCount} albums)
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/screens/LibraryScreen.tsx
git commit -m "feat: LibraryScreen with incremental loading and song/album/artist views"
```

---

## Task 15: Queue, Search, Settings, Login Screens

**Files:**
- Create: `src/components/screens/QueueScreen.tsx`
- Create: `src/components/screens/SearchScreen.tsx`
- Create: `src/components/screens/SettingsScreen.tsx`
- Create: `src/components/screens/LoginScreen.tsx`

- [ ] **Step 1: src/components/screens/QueueScreen.tsx を実装**

```tsx
// src/components/screens/QueueScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useQueueStore } from '../../stores/queue.store'
import { usePlayerStore } from '../../stores/player.store'
import type { AppConfig } from '../../types/config'

type Props = { config: AppConfig }

export function QueueScreen({ config }: Props) {
  const { items, currentIndex } = useQueueStore()
  const { currentSong } = usePlayerStore()

  if (items.length === 0) {
    return <Text color={config.theme.subtle}>Queue is empty. Press q on a song to add it.</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color={config.theme.subtle} dimColor>
        {items.length} tracks · x = remove · X = clear · Ctrl+j/k = reorder
      </Text>
      {items.map((song, i) => {
        const isPlaying = i === currentIndex
        return (
          <Box key={`${song.id}-${i}`}>
            <Text color={isPlaying ? config.theme.highlight : config.theme.subtle}>
              {isPlaying ? '▶ ' : `${String(i + 1).padStart(2)}. `}
              {song.title} — {song.artist}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: src/components/screens/SearchScreen.tsx を実装**

```tsx
// src/components/screens/SearchScreen.tsx
import React, { useState, useEffect } from 'react'
import { Box, Text, TextInput } from 'ink'
import { SongTable } from '../shared/SongTable'
import type { AppConfig } from '../../types/config'
import type { SubsonicClient } from '../../services/subsonic'
import type { SearchResult } from '../../types/subsonic'

type Props = { config: AppConfig; subsonic: SubsonicClient }

export function SearchScreen({ config, subsonic }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ songs: [], albums: [], artists: [] })
  const [filter, setFilter] = useState<'songs' | 'albums' | 'artists'>('songs')
  const [cursor, setCursor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults({ songs: [], albums: [], artists: [] }); return }
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await subsonic.search(query)
        setResults(res)
        setCursor(0)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box gap={1} marginBottom={1}>
        <Text color={config.theme.subtle}>/</Text>
        <TextInput value={query} onChange={setQuery} placeholder="Search songs, albums, artists..." />
      </Box>
      <Box gap={2} marginBottom={1}>
        {(['songs', 'albums', 'artists'] as const).map(f => (
          <Text
            key={f}
            color={f === filter ? config.theme.highlight : config.theme.subtle}
            underline={f === filter}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}({results[f].length})
          </Text>
        ))}
      </Box>
      {isLoading ? (
        <Text color={config.theme.subtle}>Searching...</Text>
      ) : filter === 'songs' ? (
        <SongTable
          songs={results.songs}
          cursor={cursor}
          columns={config.columns.songs}
          highlight={config.theme.highlight}
          subtle={config.theme.subtle}
        />
      ) : filter === 'albums' ? (
        <Box flexDirection="column">
          {results.albums.map((a, i) => (
            <Text key={a.id} color={i === cursor ? config.theme.highlight : config.theme.subtle}>
              {a.name} — {a.artist}
            </Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {results.artists.map((a, i) => (
            <Text key={a.id} color={i === cursor ? config.theme.highlight : config.theme.subtle}>
              {a.name}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 3: src/components/screens/SettingsScreen.tsx を実装**

```tsx
// src/components/screens/SettingsScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { AppConfig } from '../../types/config'

type Props = { config: AppConfig }

export function SettingsScreen({ config }: Props) {
  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text color={config.theme.highlight} bold>Settings</Text>
      <Text color={config.theme.subtle}>Edit ~/.config/&lt;appname&gt;/config.toml to change settings.</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text color={config.theme.subtle}>Volume: {config.app.defaultVolume}</Text>
        <Text color={config.theme.subtle}>Gapless: {config.app.gaplessPlayback}</Text>
        <Text color={config.theme.subtle}>ReplayGain: {config.app.replaygain}</Text>
        <Text color={config.theme.subtle}>Notifications: {config.app.notifications ? 'on' : 'off'}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: src/components/screens/LoginScreen.tsx を実装**

```tsx
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
```

- [ ] **Step 5: コミット**

```bash
git add src/components/screens/
git commit -m "feat: Queue, Search, Settings, Login screens"
```

---

## Task 16: App Root + Main Entry

**Files:**
- Modify: `src/main.tsx`
- Create: `src/app.tsx`

- [ ] **Step 1: src/app.tsx を実装**

```tsx
// src/app.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useStdout } from 'ink'
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
  const { nextLoopMode, setVolume, volume, loopMode } = usePlayerStore()
  const { next, prev, enqueueNext, enqueueLast } = useQueueStore()
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
    if (!mpv || !subsonic || !scrobble) return

    // 再生操作
    if (category === 'playback') {
      if (action === 'play_pause') await mpv.togglePause()
      if (action === 'next') { scrobble.onSongSkip(); const s = next(); if (s) { await mpv.loadFile(subsonic.streamUrl(s.id)); setCurrentSong(s); scrobble.onSongStart(s) } }
      if (action === 'prev') { scrobble.onSongSkip(); const s = prev(); if (s) { await mpv.loadFile(subsonic.streamUrl(s.id)); setCurrentSong(s); scrobble.onSongStart(s) } }
      if (action === 'volume_up') await mpv.setVolume(volume + 5)
      if (action === 'volume_down') await mpv.setVolume(Math.max(0, volume - 5))
      if (action === 'loop') nextLoopMode()
      if (action === 'rewind') await mpv.seek(-10)
      if (action === 'forward') await mpv.seek(10)
      if (action === 'restart') await mpv.seekAbsolute(0)
      if (action === 'toggle_now_playing') toggleNowPlaying()
    }

    // タブ/グローバル
    if (category === 'global') {
      if (action === 'tab_next') nextTab()
      if (action === 'tab_prev') prevTab()
      if (action === 'tab_1') setTab('library')
      if (action === 'tab_2') setTab('queue')
      if (action === 'tab_3') setTab('search')
      if (action === 'tab_4') setTab('settings')
      if (action === 'quit') { await mpv.quit(); process.exit(0) }
    }
  }, [mpv, subsonic, scrobble, volume, next, prev, nextTab, prevTab, setTab, toggleNowPlaying, nextLoopMode])

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
```

- [ ] **Step 2: src/main.tsx を更新**

```tsx
// src/main.tsx
import React from 'react'
import { render } from 'ink'
import { App } from './app'

const { unmount } = render(<App />, { patchConsole: true })

process.on('SIGTERM', () => { unmount(); process.exit(0) })
process.on('SIGINT', () => { unmount(); process.exit(0) })
```

- [ ] **Step 3: コミット**

```bash
git add src/app.tsx src/main.tsx
git commit -m "feat: app root with full key handler and service wiring"
```

---

## Task 17: Smoke Test & Integration

- [ ] **Step 1: 型チェック**

```bash
bun run typecheck
```

Expected: 型エラーなし。エラーがあれば修正してから次へ。

- [ ] **Step 2: 全ユニットテストを実行**

```bash
bun test tests/unit/
```

Expected: 全テスト green。

- [ ] **Step 3: 起動確認（サーバーなしでもログイン画面が出ること）**

```bash
bun run src/main.tsx
```

Expected: ログイン画面が表示される。`Ctrl+c` で終了。

- [ ] **Step 4: Subsonic サーバーに接続して動作確認**

ログイン画面にサーバー URL / ユーザー名 / パスワードを入力してログイン。

以下を確認:
- Library タブに楽曲リストが表示される
- `j`/`k` でカーソル移動できる
- `Enter` で曲が再生される
- フッターのプレイヤーバーに曲名・進捗バーが表示される
- `Space` で一時停止/再生
- `+`/`-` でボリューム変化
- `M` で Now Playing オーバーレイが開く
- `2` または `Tab` でキュータブに切り替わる
- Last.fm (Subsonic 経由) で Now Playing が即時更新される

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: complete TUI music player v0.1.0"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ タブ型フルワイドレイアウト (Task 13, 16)
- ✅ スクロブル修正 — Now Playing 即時 + 完了タイミング (Task 6)
- ✅ アルバムアート Kitty protocol (Task 8, 12)
- ✅ フッターサムネイル常時表示 (Task 13)
- ✅ M キーで Now Playing オーバーレイ (Task 13, 16)
- ✅ Zustand 4スライス (Task 10)
- ✅ MPV IPC (Task 7)
- ✅ TOML 設定 (Task 3)
- ✅ キーバインド設定可能 (Task 4, 11)
- ✅ デスクトップ通知 (Task 9, 16)
- ✅ インクリメンタルロード (Task 14)
- ✅ エラーハンドリング (Task 5 の request 関数)
- ✅ LRU 画像キャッシュ (Task 8)
- ✅ `Z Z` 終了 (Task 11)
- ✅ ログイン画面 (Task 15)
- ✅ Bun + Ink + Zustand + smol-toml + jimp + lru-cache

**Type consistency check:**
- `SubsonicClient.scrobble(id, opts)` — Task 5 で定義、Task 6 の ScrobbleService コンストラクタで使用 ✅
- `MpvClient.getStatus()` → `MpvStatus` — Task 7 で定義、Task 11 の useMpvSync で使用 ✅
- `useQueueStore` — Task 10 で定義、Task 14/15/16 で使用 ✅
- `AppConfig.theme.highlight/subtle` — Task 2 で定義、全コンポーネントで使用 ✅
