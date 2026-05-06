# SubTSUI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1 で露呈した設計問題（単一 global handler、店舗カーソル混在、未配線機能）を解消し、3 層キー入力ルーティング + タブ別履歴スタックの新アーキテクチャで MVP（ログイン → アルバム閲覧 → 再生 → キュー → 検索 → スクロブル）を再実装する。

**Architecture:** `framework/` レイヤーに Screen/KeyRouter/WindowList/safeLoad を配置し、`stores/nav` が画面遷移を、各 `screens/*` が onKey で screen-local キーを担う。グローバル再生キーは `app.tsx` の playbackController に集約。

**Tech Stack:** Bun, Ink v5, ink-text-input, React 18, Zustand 5, smol-toml, jimp, lru-cache, MPV (subprocess)

**Reference docs:**
- `docs/superpowers/specs/2026-05-06-tui-music-player-v2-design.md`（仕様書）
- `docs/steering/architecture.md`
- `docs/steering/keyboard-routing.md`
- `docs/steering/state-management.md`

---

## Progress Summary

タスクを完了したらチェックボックスを埋め、Phase 末尾の合計を更新する。

- Phase 0 (Branch & Cleanup): 2/2 ✅
- Phase 1 (Framework): 7/7 ✅
- Phase 2 (Stores): 0/2
- Phase 3 (Services): 0/3
- Phase 4 (Components): 0/7
- Phase 5 (Screens): 0/7
- Phase 6 (App Wiring): 0/5
- Phase 7 (Testing & QA): 0/3

---

## File Map

```
src/
  main.tsx                         (modify — final wiring)
  app.tsx                          (rewrite from scratch)

  screens/                         (NEW directory)
    AlbumsScreen.tsx
    AlbumDetailScreen.tsx
    ArtistDetailScreen.tsx
    QueueScreen.tsx
    SearchScreen.tsx
    LoginScreen.tsx
    NowPlayingScreen.tsx

  components/                      (NEW; old components/{shared,layout,screens}/ deleted)
    PlayerBar.tsx
    TabBar.tsx
    AlbumArt.tsx
    ProgressBar.tsx
    SongRow.tsx
    AlbumRow.tsx
    StatusLine.tsx

  framework/                       (NEW directory)
    Screen.ts
    keyRouter.ts                   (pure logic)
    KeyRouter.tsx                  (React wrapper using useInput)
    WindowList.tsx
    safeLoad.ts
    ServiceContext.tsx

  stores/
    player.store.ts                (keep; minor field review)
    queue.store.ts                 (modify; add jumpTo)
    nav.store.ts                   (NEW)
    library.store.ts               (rewrite; albums cache only)
    status.store.ts                (NEW)
    ui.store.ts                    (DELETE)

  services/
    subsonic.ts                    (modify; error code classification)
    mpv.ts                         (modify; respawn + history)
    scrobble.ts                    (keep)
    image.ts                       (modify; LRU 50)
    notify.ts                      (keep)

  config/
    config.ts                      (keep)
    defaults.ts                    (modify; Layer 1/2 keybind split)
    keybinds.ts                    (keep)

  hooks/                           (DELETE entire directory)
  components/screens/              (DELETE)
  components/shared/               (DELETE)
  components/layout/               (DELETE)

tests/
  unit/
    keyrouter.test.ts              (NEW)
    nav.store.test.ts              (NEW)
    queue.test.ts                  (modify; add jumpTo tests)
    scrobble.test.ts               (keep)
    config.test.ts                 (keep)
    keybinds.test.ts               (keep)
    image.test.ts                  (keep)
  integration/
    subsonic.test.ts               (keep)
    screen-stack.test.ts           (NEW)
```

---

# Phase 0: Branch & Cleanup

## Task 0.1: ブランチ作成

**Files:** N/A (git operation)

- [ ] **Step 1: 現在の作業をコミット済みか確認**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. もし変更があれば事前にコミット。

- [ ] **Step 2: 新ブランチを切る**

```bash
git checkout -b feat/redesign-v2
```

Expected: `Switched to a new branch 'feat/redesign-v2'`

---

## Task 0.2: 不要ファイルの削除

**Files (DELETE):**
- `src/app.tsx`
- `src/hooks/useKeyHandler.ts`
- `src/hooks/useMpvSync.ts`
- `src/hooks/` (空になったディレクトリ)
- `src/components/screens/` (全ファイル)
- `src/components/shared/` (全ファイル)
- `src/components/layout/` (全ファイル)
- `src/components/` (空になったら削除)
- `src/stores/library.store.ts` (再実装するため一旦削除)
- `src/stores/ui.store.ts` (nav.store に統合するため削除)

- [ ] **Step 1: ファイル削除**

```bash
rm -rf src/app.tsx src/hooks/ src/components/ \
       src/stores/library.store.ts src/stores/ui.store.ts
```

- [ ] **Step 2: 削除を確認**

```bash
ls src/
```

Expected: `config  main.tsx  services  stores  types` のみ（screens/, components/, framework/, hooks/ はなし）

- [ ] **Step 3: main.tsx を最小化**（後で正しく書き直すが、一旦コンパイルエラーを避ける）

```tsx
// src/main.tsx
import React from 'react'
import { render, Text } from 'ink'

render(<Text>SubTSUI starting...</Text>)
```

- [ ] **Step 4: 型エラーが残っていないか確認**

```bash
bun run typecheck
```

Expected: 型エラーなし（削除したファイルへの参照は app.tsx 削除時にすべて消える）

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "chore: remove v1 implementation, prepare for redesign"
```

---

# Phase 1: Framework

## Task 1.1: framework/Screen.ts (型定義)

**Files:**
- Create: `src/framework/Screen.ts`

- [ ] **Step 1: Screen 型を定義**

```typescript
// src/framework/Screen.ts
import type { ReactNode } from 'react'

export type KeyEvent = {
  input: string
  key: {
    return?: boolean
    escape?: boolean
    tab?: boolean
    shift?: boolean
    ctrl?: boolean
    upArrow?: boolean
    downArrow?: boolean
    leftArrow?: boolean
    rightArrow?: boolean
  }
}

export type Screen = {
  /** ユニーク ID。'album-detail:42' のようにパラメータをコロンで含める */
  id: string
  /** タブヘッダー / パンくず表示用 */
  title: string
  render: () => ReactNode
  /** true を返したら Layer 1 はスキップ */
  onKey?: (e: KeyEvent) => boolean
  onMount?: () => void
  onUnmount?: () => void
  /** true なら Layer 1（global keys）を遮断する */
  isModal?: boolean
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/framework/Screen.ts
git commit -m "feat(framework): Screen interface and KeyEvent type"
```

---

## Task 1.2: stores/nav.store.ts

**Files:**
- Create: `tests/unit/nav.store.test.ts`
- Create: `src/stores/nav.store.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/nav.store.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { useNavStore } from '../../src/stores/nav.store'
import type { Screen } from '../../src/framework/Screen'

const makeScreen = (id: string): Screen => ({
  id,
  title: id,
  render: () => null,
})

describe('nav.store', () => {
  beforeEach(() => {
    useNavStore.setState({
      activeTab: 'library',
      stacks: { library: [], queue: [], search: [] },
      modal: null,
      textInputFocused: false,
    })
  })

  test('push: 現在タブのスタック末尾に追加される', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a', 'b'])
  })

  test('push: 他タブのスタックには影響しない', () => {
    useNavStore.getState().push(makeScreen('a'))
    expect(useNavStore.getState().stacks.queue).toEqual([])
    expect(useNavStore.getState().stacks.search).toEqual([])
  })

  test('pop: 最後の要素を削除して true を返す', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    expect(s.pop()).toBe(true)
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('pop: ルート（要素1個以下）では false を返す', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    expect(s.pop()).toBe(false)
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('replace: 末尾を新スクリーンに置き換える', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    s.replace(makeScreen('c'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a', 'c'])
  })

  test('replace: 空スタックなら追加と同じ', () => {
    useNavStore.getState().replace(makeScreen('a'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('replaceStack: 指定タブのスタック全体を置き換える', () => {
    const s = useNavStore.getState()
    s.replaceStack('queue', [makeScreen('q1'), makeScreen('q2')])
    expect(useNavStore.getState().stacks.queue.map(x => x.id)).toEqual(['q1', 'q2'])
  })

  test('setTab: スタックは保持される', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.setTab('queue')
    expect(useNavStore.getState().activeTab).toBe('queue')
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('openModal/closeModal: スタックとは独立', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.openModal(makeScreen('m'))
    expect(useNavStore.getState().modal?.id).toBe('m')
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
    s.closeModal()
    expect(useNavStore.getState().modal).toBeNull()
  })

  test('setTextInputFocused: フラグが反映される', () => {
    useNavStore.getState().setTextInputFocused(true)
    expect(useNavStore.getState().textInputFocused).toBe(true)
    useNavStore.getState().setTextInputFocused(false)
    expect(useNavStore.getState().textInputFocused).toBe(false)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

```bash
bun test tests/unit/nav.store.test.ts
```

Expected: FAIL with "Cannot find module '../../src/stores/nav.store'"

- [ ] **Step 3: nav.store.ts を実装**

```typescript
// src/stores/nav.store.ts
import { create } from 'zustand'
import type { Screen } from '../framework/Screen'

export type Tab = 'library' | 'queue' | 'search'

type NavState = {
  activeTab: Tab
  stacks: Record<Tab, Screen[]>
  modal: Screen | null
  textInputFocused: boolean

  setTab: (t: Tab) => void
  push: (s: Screen) => void
  pop: () => boolean
  replace: (s: Screen) => void
  replaceStack: (t: Tab, screens: Screen[]) => void
  openModal: (s: Screen) => void
  closeModal: () => void
  setTextInputFocused: (v: boolean) => void
}

export const useNavStore = create<NavState>((set, get) => ({
  activeTab: 'library',
  stacks: { library: [], queue: [], search: [] },
  modal: null,
  textInputFocused: false,

  setTab: (t) => set({ activeTab: t }),

  push: (s) => set((st) => {
    const tab = st.activeTab
    return { stacks: { ...st.stacks, [tab]: [...st.stacks[tab], s] } }
  }),

  pop: () => {
    const st = get()
    const tab = st.activeTab
    const stack = st.stacks[tab]
    if (stack.length <= 1) return false
    const top = stack[stack.length - 1]
    top?.onUnmount?.()
    set({ stacks: { ...st.stacks, [tab]: stack.slice(0, -1) } })
    return true
  },

  replace: (s) => set((st) => {
    const tab = st.activeTab
    const stack = st.stacks[tab]
    const newStack = stack.length === 0 ? [s] : [...stack.slice(0, -1), s]
    return { stacks: { ...st.stacks, [tab]: newStack } }
  }),

  replaceStack: (t, screens) => set((st) => ({
    stacks: { ...st.stacks, [t]: screens },
  })),

  openModal: (s) => set({ modal: s }),
  closeModal: () => {
    const m = get().modal
    m?.onUnmount?.()
    set({ modal: null })
  },

  setTextInputFocused: (v) => set({ textInputFocused: v }),
}))
```

- [ ] **Step 4: テスト合格確認**

```bash
bun test tests/unit/nav.store.test.ts
```

Expected: 10 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/stores/nav.store.ts tests/unit/nav.store.test.ts
git commit -m "feat(stores): nav.store with tab-based screen stack"
```

---

## Task 1.3: stores/status.store.ts

**Files:**
- Create: `src/stores/status.store.ts`

- [ ] **Step 1: 実装**

このストアは autoHide タイマーを内包する。

```typescript
// src/stores/status.store.ts
import { create } from 'zustand'

export type StatusLevel = 'info' | 'warn' | 'error'

type StatusState = {
  message: string | null
  level: StatusLevel | null

  setStatus: (msg: string, level: StatusLevel, autoHideMs?: number) => void
  clear: () => void
}

const DEFAULT_HIDE_MS: Record<StatusLevel, number> = {
  info: 3000,
  warn: 5000,
  error: 8000,
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useStatusStore = create<StatusState>((set) => ({
  message: null,
  level: null,

  setStatus: (msg, level, autoHideMs) => {
    if (timer) clearTimeout(timer)
    set({ message: msg, level })
    const hide = autoHideMs ?? DEFAULT_HIDE_MS[level]
    timer = setTimeout(() => {
      set({ message: null, level: null })
      timer = null
    }, hide)
  },

  clear: () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    set({ message: null, level: null })
  },
}))
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/stores/status.store.ts
git commit -m "feat(stores): status.store for StatusLine messages with auto-hide"
```

---

## Task 1.4: framework/keyRouter.ts (純粋ロジック)

ルーティングの判断は React に依存しない関数として分離し、テスト可能にする。

**Files:**
- Create: `tests/unit/keyrouter.test.ts`
- Create: `src/framework/keyRouter.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/unit/keyrouter.test.ts
import { describe, test, expect } from 'bun:test'
import { decideRoute } from '../../src/framework/keyRouter'
import type { Screen, KeyEvent } from '../../src/framework/Screen'

const baseScreen: Screen = {
  id: 'test',
  title: 'test',
  render: () => null,
}

const ev = (input: string, key: Partial<KeyEvent['key']> = {}): KeyEvent => ({ input, key })

describe('decideRoute', () => {
  test('Layer 3 ON で Esc 以外は "blocked"', () => {
    const r = decideRoute(ev('j'), { textInputFocused: true, screen: baseScreen, modal: null })
    expect(r).toBe('blocked')
  })

  test('Layer 3 ON でも Esc は "screen"', () => {
    const r = decideRoute(ev('', { escape: true }), { textInputFocused: true, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })

  test('Layer 2 が consume を返す可能性 → "screen" に到達', () => {
    const r = decideRoute(ev('j'), { textInputFocused: false, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })

  test('modal が isModal=true なら Layer 1 はスキップ → "screen-only"', () => {
    const modal: Screen = { ...baseScreen, id: 'modal', isModal: true }
    const r = decideRoute(ev('Space'), { textInputFocused: false, screen: baseScreen, modal })
    expect(r).toBe('screen-only')
  })

  test('modal が isModal=false なら通常通り Layer 1 まで進める', () => {
    const modal: Screen = { ...baseScreen, id: 'modal', isModal: false }
    const r = decideRoute(ev('Space'), { textInputFocused: false, screen: baseScreen, modal })
    expect(r).toBe('screen')
  })

  test('modal なしの通常時: "screen"', () => {
    const r = decideRoute(ev('n'), { textInputFocused: false, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })
})

describe('activeScreen 選択', () => {
  test('modal があれば modal を返す', () => {
    const m: Screen = { ...baseScreen, id: 'm' }
    const s: Screen = { ...baseScreen, id: 's' }
    // resolveActiveScreen を export していれば直接テスト可能。詳細は実装で
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

```bash
bun test tests/unit/keyrouter.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: 実装**

```typescript
// src/framework/keyRouter.ts
import type { Screen, KeyEvent } from './Screen'

export type RouteDecision =
  | 'blocked'      // Layer 3 が遮断（Esc 以外）
  | 'screen-only'  // Layer 2 だけ評価、Layer 1 はスキップ
  | 'screen'       // Layer 2 → 1 の通常フロー

export function decideRoute(
  e: KeyEvent,
  ctx: { textInputFocused: boolean; screen: Screen; modal: Screen | null }
): RouteDecision {
  // Layer 3: TextInput active
  if (ctx.textInputFocused && !e.key.escape) return 'blocked'

  // Modal がアクティブで isModal=true なら Layer 1 をスキップ
  const active = ctx.modal ?? ctx.screen
  if (active.isModal) return 'screen-only'

  return 'screen'
}

export function resolveActiveScreen(
  modal: Screen | null,
  topOfStack: Screen | undefined
): Screen | null {
  return modal ?? topOfStack ?? null
}
```

- [ ] **Step 4: テスト合格確認**

```bash
bun test tests/unit/keyrouter.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/framework/keyRouter.ts tests/unit/keyrouter.test.ts
git commit -m "feat(framework): keyRouter pure routing logic with 3-layer decision"
```

---

## Task 1.5: framework/KeyRouter.tsx (React wrapper)

**Files:**
- Create: `src/framework/KeyRouter.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/framework/KeyRouter.tsx
import React, { useRef } from 'react'
import { useInput } from 'ink'
import { useNavStore } from '../stores/nav.store'
import { decideRoute, resolveActiveScreen } from './keyRouter'
import type { KeyEvent } from './Screen'

type GlobalHandler = (e: KeyEvent) => void

type Props = {
  /** Layer 1 のグローバルキー処理。app.tsx から渡される */
  onGlobalKey: GlobalHandler
  children: React.ReactNode
}

export function KeyRouter({ onGlobalKey, children }: Props) {
  const lastZRef = useRef<number>(0)

  const activeTab = useNavStore(s => s.activeTab)
  const stacks = useNavStore(s => s.stacks)
  const modal = useNavStore(s => s.modal)
  const textInputFocused = useNavStore(s => s.textInputFocused)

  useInput((input, key) => {
    const e: KeyEvent = { input, key }

    if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    const topOfStack = stacks[activeTab][stacks[activeTab].length - 1]
    const active = resolveActiveScreen(modal, topOfStack)
    if (!active) return

    const route = decideRoute(e, { textInputFocused, screen: active, modal })

    if (route === 'blocked') return

    // Layer 2: Screen の onKey
    if (active.onKey?.(e)) return

    if (route === 'screen-only') return

    // Z Z double-tap (Layer 1)
    if (input === 'Z') {
      const now = Date.now()
      if (now - lastZRef.current < 300) {
        process.exit(0)
      }
      lastZRef.current = now
      return
    }

    // Layer 1
    onGlobalKey(e)
  })

  return <>{children}</>
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/framework/KeyRouter.tsx
git commit -m "feat(framework): KeyRouter React wrapper using useInput"
```

---

## Task 1.6: framework/WindowList.tsx

長いリストを表示行数だけ render する汎用コンポーネント。

**Files:**
- Create: `src/framework/WindowList.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/framework/WindowList.tsx
import React from 'react'
import { Box } from 'ink'

type Props<T> = {
  items: T[]
  cursor: number
  height: number   // 表示行数
  renderItem: (item: T, index: number, isCursor: boolean) => React.ReactNode
}

/**
 * カーソル位置を中心に固定行数だけ render する。
 * - cursor が窓の上端／下端に近づいたら窓をスライド。
 * - items.length <= height なら全件表示。
 */
export function WindowList<T>({ items, cursor, height, renderItem }: Props<T>) {
  if (items.length === 0) return null

  // 窓の開始位置を決める（カーソルを中央あたりに保つ）
  const half = Math.floor(height / 2)
  let start = cursor - half
  if (start < 0) start = 0
  if (start + height > items.length) start = Math.max(0, items.length - height)
  const end = Math.min(items.length, start + height)

  const slice = items.slice(start, end)

  return (
    <Box flexDirection="column">
      {slice.map((item, i) => {
        const absIndex = start + i
        return (
          <React.Fragment key={absIndex}>
            {renderItem(item, absIndex, absIndex === cursor)}
          </React.Fragment>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/framework/WindowList.tsx
git commit -m "feat(framework): WindowList for fixed-height list rendering"
```

---

## Task 1.7: framework/safeLoad.ts と framework/ServiceContext.tsx

**Files:**
- Create: `src/framework/safeLoad.ts`
- Create: `src/framework/ServiceContext.tsx`

- [ ] **Step 1: safeLoad を実装**

```typescript
// src/framework/safeLoad.ts
import { useStatusStore } from '../stores/status.store'

/**
 * 非同期処理をエラー耐性つきで実行する。
 * 失敗時は status.store にエラー報告し null を返す。
 */
export async function safeLoad<T>(
  fn: () => Promise<T>,
  errorMsg: string
): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? `${errorMsg}: ${e.message}` : errorMsg
    useStatusStore.getState().setStatus(msg, 'error')
    return null
  }
}
```

- [ ] **Step 2: ServiceContext を実装**

```typescript
// src/framework/ServiceContext.tsx
import React, { createContext, useContext } from 'react'
import type { SubsonicClient } from '../services/subsonic'
import type { MpvClient } from '../services/mpv'
import type { ScrobbleService } from '../services/scrobble'
import type { AppConfig } from '../types/config'

export type PlaybackController = {
  togglePause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  volumeDelta: (delta: number) => Promise<void>
  seekRelative: (sec: number) => Promise<void>
  seekTo: (sec: number) => Promise<void>
  toggleLoopMode: () => void
  /** 指定の曲を即座に再生（キュー操作を伴わない） */
  playSong: (song: import('../types/subsonic').Song) => Promise<void>
}

export type Services = {
  subsonic: SubsonicClient
  mpv: MpvClient
  scrobble: ScrobbleService
  controller: PlaybackController
  config: AppConfig
}

const ServiceContext = createContext<Services | null>(null)

export function ServiceProvider({ value, children }: { value: Services; children: React.ReactNode }) {
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
}

export function useServices(): Services {
  const ctx = useContext(ServiceContext)
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider')
  return ctx
}
```

- [ ] **Step 3: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 4: コミット**

```bash
git add src/framework/safeLoad.ts src/framework/ServiceContext.tsx
git commit -m "feat(framework): safeLoad and ServiceContext"
```

---

# Phase 2: Stores

## Task 2.1: queue.store.ts に jumpTo 追加

**Files:**
- Modify: `src/stores/queue.store.ts`
- Modify: `tests/unit/queue.test.ts`

- [ ] **Step 1: テスト追加**

`tests/unit/queue.test.ts` に以下のケースを追記：

```typescript
test('jumpTo: 指定インデックスを currentIndex に設定する', () => {
  useQueueStore.setState({ items: [makeSong('1'), makeSong('2'), makeSong('3')], currentIndex: 0 })
  useQueueStore.getState().jumpTo(2)
  expect(useQueueStore.getState().currentIndex).toBe(2)
})

test('jumpTo: 範囲外は currentIndex を変更しない', () => {
  useQueueStore.setState({ items: [makeSong('1'), makeSong('2')], currentIndex: 0 })
  useQueueStore.getState().jumpTo(5)
  expect(useQueueStore.getState().currentIndex).toBe(0)
  useQueueStore.getState().jumpTo(-1)
  expect(useQueueStore.getState().currentIndex).toBe(0)
})

test('next: 末尾で null を返す（loopMode を関知しない）', () => {
  useQueueStore.setState({ items: [makeSong('1'), makeSong('2')], currentIndex: 1 })
  expect(useQueueStore.getState().next()).toBeNull()
})

test('prev: 先頭で null を返す', () => {
  useQueueStore.setState({ items: [makeSong('1'), makeSong('2')], currentIndex: 0 })
  expect(useQueueStore.getState().prev()).toBeNull()
})
```

- [ ] **Step 2: 失敗を確認**

```bash
bun test tests/unit/queue.test.ts
```

Expected: jumpTo を呼んでいるテストが FAIL

- [ ] **Step 3: queue.store.ts に jumpTo 追加**

`src/stores/queue.store.ts` の `QueueState` 型に追加：

```typescript
jumpTo: (index: number) => void
```

実装に追加：

```typescript
jumpTo: (index) => set(s => {
  if (index < 0 || index >= s.items.length) return s
  return { currentIndex: index }
}),
```

- [ ] **Step 4: テスト合格確認**

```bash
bun test tests/unit/queue.test.ts
```

Expected: 全 11 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/stores/queue.store.ts tests/unit/queue.test.ts
git commit -m "feat(stores): queue.store add jumpTo, clarify next/prev null at boundary"
```

---

## Task 2.2: stores/library.store.ts (再実装)

Albums キャッシュとページング状態だけを持つ。曲は持たない。

**Files:**
- Create: `src/stores/library.store.ts`

- [ ] **Step 1: 実装**

```typescript
// src/stores/library.store.ts
import { create } from 'zustand'
import type { Album } from '../types/subsonic'

type LibraryState = {
  albums: Album[]
  albumsLoaded: boolean       // 一度でも fetch したか
  albumsHasMore: boolean       // 続きがあるか
  albumsOffset: number

  setAlbums: (a: Album[]) => void
  appendAlbums: (a: Album[]) => void
  setAlbumsHasMore: (v: boolean) => void
  setAlbumsOffset: (v: number) => void
  setAlbumsLoaded: (v: boolean) => void
  invalidate: () => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  albums: [],
  albumsLoaded: false,
  albumsHasMore: true,
  albumsOffset: 0,

  setAlbums: (a) => set({ albums: a }),
  appendAlbums: (a) => set((s) => ({ albums: [...s.albums, ...a] })),
  setAlbumsHasMore: (v) => set({ albumsHasMore: v }),
  setAlbumsOffset: (v) => set({ albumsOffset: v }),
  setAlbumsLoaded: (v) => set({ albumsLoaded: v }),

  invalidate: () => set({
    albums: [], albumsLoaded: false, albumsHasMore: true, albumsOffset: 0,
  }),
}))
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/stores/library.store.ts
git commit -m "feat(stores): library.store simplified to albums cache only"
```

---

# Phase 3: Services

## Task 3.1: mpv.ts に respawn と履歴保持を追加

**Files:**
- Modify: `src/services/mpv.ts`

- [ ] **Step 1: `lastFile` / `lastPos` を保持するフィールドと、loadFile/seek でそれを更新**

`MpvClient` クラスに以下を追加：

```typescript
private lastFile: string | null = null
private lastPos: number = 0
```

`loadFile` を修正：

```typescript
async loadFile(url: string, startPaused = false): Promise<void> {
  await this.send(['loadfile', url, 'replace'])
  this.lastFile = url
  this.lastPos = 0
  if (startPaused) await this.setPause(true)
}
```

`seekAbsolute` も lastPos を更新：

```typescript
async seekAbsolute(seconds: number): Promise<void> {
  await this.send(['seek', seconds, 'absolute'])
  this.lastPos = seconds
}
```

`getStatus()` で取得した位置も保存（500ms ごとの polling で十分）。`getStatus` の最後に：

```typescript
this.lastPos = pos ?? this.lastPos
```

- [ ] **Step 2: respawn メソッドを追加**

```typescript
async respawn(opts: {
  volume?: number
  gapless?: 'yes' | 'no' | 'weak'
  replaygain?: 'track' | 'album' | 'no'
}): Promise<void> {
  const file = this.lastFile
  const pos = this.lastPos
  await this.spawn(opts)
  if (file) {
    await this.loadFile(file)
    if (pos > 0) await this.seekAbsolute(pos)
  }
}
```

- [ ] **Step 3: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 4: コミット**

```bash
git add src/services/mpv.ts
git commit -m "feat(mpv): add respawn() with last file/position recovery"
```

---

## Task 3.2: subsonic.ts のエラー分類を改善

**Files:**
- Modify: `src/services/subsonic.ts`

- [ ] **Step 1: SubsonicError に retryable 分類を強化**

`subsonic.ts` の冒頭、`SubsonicError` 周辺を以下に置き換え：

```typescript
export class SubsonicError extends Error {
  constructor(public code: number, message: string, public retryable: boolean) {
    super(message)
  }
}

/** Subsonic の error code を retryable 判定 */
function isCodeRetryable(code: number): boolean {
  // 50系（サーバ内部エラー想定）は再試行、40/41（認証）は不可
  if (code >= 50 && code < 60) return true
  return false
}

function isAuthError(code: number): boolean {
  return code === 40 || code === 41
}
```

`request()` 内のエラー判定を更新：

```typescript
const sr = json['subsonic-response']
if (sr.status === 'failed') {
  const err = sr.error ?? {}
  const code = Number(err.code ?? -1)
  const message = String(err.message ?? 'unknown subsonic error')
  throw new SubsonicError(code, message, isCodeRetryable(code))
}
```

- [ ] **Step 2: isAuthError を export**

```typescript
export { isAuthError }
```

- [ ] **Step 3: 型チェック・既存テスト合格確認**

```bash
bun run typecheck
bun test tests/integration/subsonic.test.ts
```

Expected: 既存テスト pass

- [ ] **Step 4: コミット**

```bash
git add src/services/subsonic.ts
git commit -m "feat(subsonic): classify error codes (auth vs retryable)"
```

---

## Task 3.3: image.ts の LRU を 50 に拡大

**Files:**
- Modify: `src/services/image.ts`

- [ ] **Step 1: `new LRUCache({ max: 20 })` を `max: 50` に変更**

```typescript
const cache = new LRUCache<string, Buffer>({ max: 50 })
```

- [ ] **Step 2: 既存テスト合格**

```bash
bun test tests/unit/image.test.ts
```

- [ ] **Step 3: コミット**

```bash
git add src/services/image.ts
git commit -m "perf(image): expand LRU cache from 20 to 50"
```

---

# Phase 4: Components

純粋表示コンポーネント。ロジックなし、props だけで決まる。

## Task 4.1: components/StatusLine.tsx

**Files:**
- Create: `src/components/StatusLine.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/StatusLine.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useStatusStore } from '../stores/status.store'

const ICONS = { info: 'ℹ', warn: '⚠', error: '✖' } as const
const COLORS = { info: '#9ca3af', warn: '#fbbf24', error: '#f87171' } as const

export function StatusLine() {
  const message = useStatusStore(s => s.message)
  const level = useStatusStore(s => s.level)

  if (!message || !level) return null

  return (
    <Box paddingX={1}>
      <Text color={COLORS[level]}>{ICONS[level]} {message}</Text>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/components/StatusLine.tsx
git commit -m "feat(components): StatusLine subscribes to status.store"
```

---

## Task 4.2: components/TabBar.tsx

**Files:**
- Create: `src/components/TabBar.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/TabBar.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { useNavStore, type Tab } from '../stores/nav.store'

const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'queue',   label: 'Queue' },
  { id: 'search',  label: 'Search' },
]

type Props = {
  highlight: string
  subtle: string
}

export function TabBar({ highlight, subtle }: Props) {
  const activeTab = useNavStore(s => s.activeTab)

  return (
    <Box paddingX={1}>
      {TABS.map((t, i) => {
        const isActive = t.id === activeTab
        return (
          <Box key={t.id} marginRight={2}>
            <Text color={isActive ? highlight : subtle} bold={isActive}>
              {isActive ? `[${t.label}]` : ` ${t.label} `}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/components/TabBar.tsx
git commit -m "feat(components): TabBar subscribes to nav.store"
```

---

## Task 4.3: components/AlbumRow.tsx

**Files:**
- Create: `src/components/AlbumRow.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/AlbumRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Album } from '../types/subsonic'

type Props = {
  album: Album
  isCursor: boolean
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s.padEnd(len)
  return s.slice(0, len - 1) + '…'
}

export function AlbumRow({ album, isCursor, highlight, subtle }: Props) {
  const color = isCursor ? highlight : subtle
  const prefix = isCursor ? '▶ ' : '  '
  return (
    <Box>
      <Text color={color} inverse={isCursor}>
        {prefix}
        {truncate(album.name, 28)}  {truncate(album.artist, 22)}  {album.year ?? '----'}
      </Text>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/components/AlbumRow.tsx
git commit -m "feat(components): AlbumRow display"
```

---

## Task 4.4: components/SongRow.tsx

**Files:**
- Create: `src/components/SongRow.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/SongRow.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Song } from '../types/subsonic'

type Props = {
  song: Song
  isCursor: boolean
  isPlaying: boolean
  showTrackNumber?: boolean
  showAlbum?: boolean
  showArtist?: boolean
  highlight: string
  subtle: string
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s.padEnd(len)
  return s.slice(0, len - 1) + '…'
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SongRow({
  song, isCursor, isPlaying,
  showTrackNumber = true, showAlbum = false, showArtist = true,
  highlight, subtle,
}: Props) {
  const color = isPlaying ? highlight : isCursor ? highlight : subtle
  const prefix = isPlaying ? '▶ ' : isCursor ? '▶ ' : '  '

  return (
    <Box>
      <Text color={color} inverse={isCursor && !isPlaying}>
        {prefix}
        {showTrackNumber && (song.trackNumber ? `${song.trackNumber.toString().padStart(2)}.  ` : '    ')}
        {truncate(song.title, 32)}
        {showArtist && `  ${truncate(song.artist, 20)}`}
        {showAlbum && `  ${truncate(song.album, 20)}`}
        {`  ${fmtDuration(song.duration)}`}
      </Text>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add src/components/SongRow.tsx
git commit -m "feat(components): SongRow display"
```

---

## Task 4.5: components/ProgressBar.tsx

**Files:**
- Create: `src/components/ProgressBar.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/ProgressBar.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  position: number   // sec
  duration: number
  width?: number     // 文字数（デフォルト 30）
  color?: string
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ProgressBar({ position, duration, width = 30, color = '#7dd3fc' }: Props) {
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0
  const filled = Math.floor(ratio * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  return (
    <Box>
      <Text color={color}>{bar}</Text>
      <Text color="#6b7280">  {fmtTime(position)}/{fmtTime(duration)}</Text>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/components/ProgressBar.tsx
git commit -m "feat(components): ProgressBar with fixed width"
```

---

## Task 4.6: components/AlbumArt.tsx

**Files:**
- Create: `src/components/AlbumArt.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/AlbumArt.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { fetchAndRender, detectProtocol } from '../services/image'

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
    fetchAndRender(coverArtUrl, pixelSize, PROTOCOL)
      .then(r => { if (!cancelled) setRendered(r) })
      .catch(() => setRendered(null))
    return () => { cancelled = true }
  }, [coverArtUrl, pixelSize])

  if (!rendered) {
    return <Box width={Math.ceil(pixelSize / 2)} height={Math.ceil(pixelSize / 4)}><Text>🎵</Text></Box>
  }
  return <Text>{rendered}</Text>
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/components/AlbumArt.tsx
git commit -m "feat(components): AlbumArt with protocol detection"
```

---

## Task 4.7: components/PlayerBar.tsx

**Files:**
- Create: `src/components/PlayerBar.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/components/PlayerBar.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { ProgressBar } from './ProgressBar'
import { AlbumArt } from './AlbumArt'
import { usePlayerStore } from '../stores/player.store'
import { useServices } from '../framework/ServiceContext'

function loopIcon(mode: string): string {
  if (mode === 'all') return '🔁'
  if (mode === 'one') return '🔂'
  return '  '
}

function statusIcon(status: string): string {
  if (status === 'playing') return '▶'
  if (status === 'paused') return '⏸'
  return '⏹'
}

export function PlayerBar() {
  const { subsonic, config } = useServices()
  const status = usePlayerStore(s => s.status)
  const currentSong = usePlayerStore(s => s.currentSong)
  const position = usePlayerStore(s => s.position)
  const duration = usePlayerStore(s => s.duration)
  const volume = usePlayerStore(s => s.volume)
  const loopMode = usePlayerStore(s => s.loopMode)

  const coverArtUrl = currentSong ? subsonic.coverArtUrl(currentSong.albumId, 32) : null

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="#334155">
      <Box>
        <Text color={config.theme.subtle}>{statusIcon(status)} </Text>
        <Text color={config.theme.highlight} bold>
          {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'No track'}
        </Text>
      </Box>
      <Box>
        <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
        <Text color={config.theme.subtle}>  {loopIcon(loopMode)}  🔊{Math.round(volume)}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/components/PlayerBar.tsx
git commit -m "feat(components): PlayerBar via ServiceContext + player.store"
```

注: アルバムアートのレンダリングは PlayerBar 直下より NowPlayingScreen で大きく表示する設計。フッター段は textual に保ち、AlbumArt はインポートだけしておく（NowPlayingScreen で使う）。

---

# Phase 5: Screens

## Task 5.1: screens/LoginScreen.tsx

LoginScreen は Screen インターフェースには載せず、auth 前に app.tsx が直接 render する純粋コンポーネント。

**Files:**
- Create: `src/screens/LoginScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/LoginScreen.tsx
import React, { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { Credentials } from '../types/config'

type Props = {
  onSubmit: (creds: Credentials) => void
  error?: string | null
}

export function LoginScreen({ onSubmit, error }: Props) {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [field, setField] = useState<'url' | 'username' | 'password'>('url')

  function submit() {
    if (url && username && password) {
      onSubmit({
        url: url.replace(/\/$/, ''),
        authMethod: 'plaintext',
        username,
        password,
      })
    }
  }

  return (
    <Box flexDirection="column" padding={2} gap={1}>
      <Text color="#7dd3fc" bold>SubTSUI — Login</Text>
      <Box>
        <Text color={field === 'url' ? '#7dd3fc' : '#6b7280'}>Server URL: </Text>
        <TextInput
          value={url}
          onChange={setUrl}
          onSubmit={() => setField('username')}
          placeholder="https://subsonic.example.com"
          focus={field === 'url'}
        />
      </Box>
      <Box>
        <Text color={field === 'username' ? '#7dd3fc' : '#6b7280'}>Username:   </Text>
        <TextInput
          value={username}
          onChange={setUsername}
          onSubmit={() => setField('password')}
          focus={field === 'username'}
        />
      </Box>
      <Box>
        <Text color={field === 'password' ? '#7dd3fc' : '#6b7280'}>Password:   </Text>
        <TextInput
          value={password}
          onChange={setPassword}
          onSubmit={submit}
          mask="*"
          focus={field === 'password'}
        />
      </Box>
      {error && <Text color="#f87171">{error}</Text>}
      <Text color="#6b7280">Enter to next field, Enter on password to submit</Text>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/LoginScreen.tsx
git commit -m "feat(screens): LoginScreen (pre-auth standalone component)"
```

---

## Task 5.2: screens/AlbumsScreen.tsx + ファクトリ

**Files:**
- Create: `src/screens/AlbumsScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/AlbumsScreen.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { useLibraryStore } from '../stores/library.store'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'

const PAGE = 150

function AlbumsView() {
  const { subsonic, config } = useServices()
  const albums = useLibraryStore(s => s.albums)
  const hasMore = useLibraryStore(s => s.albumsHasMore)
  const offset = useLibraryStore(s => s.albumsOffset)
  const loaded = useLibraryStore(s => s.albumsLoaded)
  const [cursor, setCursor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  useEffect(() => {
    // 初回ロード
    if (!loaded) loadMore()
  }, [])

  // カーソルが下端近くで追加 fetch
  useEffect(() => {
    if (hasMore && !isLoading && cursor >= albums.length - 30 && albums.length > 0) {
      loadMore()
    }
  }, [cursor, albums.length, hasMore, isLoading])

  // モジュール内で関数定義しているのでここで宣言
  async function loadMore() {
    if (isLoading) return
    setIsLoading(true)
    const result = await safeLoad(
      () => subsonic.getAlbumList('newest', { size: PAGE, offset }),
      'Failed to load albums'
    )
    if (result) {
      const lib = useLibraryStore.getState()
      if (offset === 0) lib.setAlbums(result)
      else lib.appendAlbums(result)
      lib.setAlbumsOffset(offset + result.length)
      lib.setAlbumsHasMore(result.length === PAGE)
      lib.setAlbumsLoaded(true)
    }
    setIsLoading(false)
  }

  if (!loaded && albums.length === 0) {
    return <Text color={config.theme.subtle}>Loading albums...</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color={config.theme.highlight} bold>
        Albums (newest)  {albums.length}{hasMore ? '+' : ''}
      </Text>
      <WindowList
        items={albums}
        cursor={cursor}
        height={winHeight}
        renderItem={(album, _i, isCursor) => (
          <AlbumRow album={album} isCursor={isCursor} highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeAlbumsScreen(): Screen {
  let cursor = 0
  return {
    id: 'albums',
    title: 'Albums',
    render: () => <AlbumsView />,
    onKey: (e: KeyEvent) => {
      const albums = useLibraryStore.getState().albums
      const max = albums.length - 1

      if (e.input === 'j' || e.key.downArrow) { cursor = Math.min(max, cursor + 1); rerender(); return true }
      if (e.input === 'k' || e.key.upArrow)   { cursor = Math.max(0,   cursor - 1); rerender(); return true }
      if (e.input === 'g')                    { cursor = 0;             rerender(); return true }
      if (e.input === 'G')                    { cursor = max;           rerender(); return true }
      if (e.key.return) {
        const album = albums[cursor]
        if (album) useNavStore.getState().push(makeAlbumDetailScreen(album.id, album.name))
        return true
      }
      if (e.key.escape || e.input === 'h') {
        // ルートなので何もしない
        return true
      }
      return false
    },
  }
}

// AlbumsView は cursor を内部 state に持つが、Screen.onKey は外側にある。
// ここを統一するため、cursor を「Screen のクロージャ変数」として持つのではなく、
// AlbumsView 自身に持たせ、Screen は AlbumsView 経由で操作する設計に変える必要がある。
// 詳細は次の修正ステップで行う。
function rerender() { /* placeholder, see Step 2 */ }
```

注: この素朴な実装は cursor を Screen クロージャ変数で持たせており、React の state と外部変数が二重管理になる。次のステップで「Screen が ref を経由して内部 state にアクセス」する形に直す。

- [ ] **Step 2: cursor 管理を AlbumsView に集約する**

`AlbumsView` に `useImperativeHandle` で外部から操作できる API を露出するか、あるいは「cursor を nav.store ではなく AlbumsScreen のローカル state にしつつ、onKey は state を更新する setter 経由で動かす」設計に書き換える。

最もシンプルなのは「cursor を React コンテキスト or zustand スライスに置く」。ここでは下記の設計で書き換える：

```typescript
// AlbumsScreen 内部に小さな zustand スライスを持つ（外部公開しない）
import { create } from 'zustand'

const useAlbumsCursor = create<{ cursor: number; set: (n: number) => void }>((set) => ({
  cursor: 0,
  set: (n) => set({ cursor: n }),
}))

function AlbumsView() {
  const cursor = useAlbumsCursor(s => s.cursor)
  // ... loadMore は前述同様 ...
  return (
    <Box flexDirection="column" flexGrow={1}>
      ...
      <WindowList items={albums} cursor={cursor} height={winHeight} renderItem={...} />
    </Box>
  )
}

export function makeAlbumsScreen(): Screen {
  return {
    id: 'albums',
    title: 'Albums',
    render: () => <AlbumsView />,
    onKey: (e: KeyEvent) => {
      const { albums } = useLibraryStore.getState()
      const max = albums.length - 1
      const c = useAlbumsCursor.getState().cursor
      const set = useAlbumsCursor.getState().set

      if (e.input === 'j' || e.key.downArrow) { set(Math.min(max, c + 1)); return true }
      if (e.input === 'k' || e.key.upArrow)   { set(Math.max(0,   c - 1)); return true }
      if (e.input === 'g')                    { set(0);             return true }
      if (e.input === 'G')                    { set(max);           return true }
      if (e.key.return) {
        const album = albums[c]
        if (album) useNavStore.getState().push(makeAlbumDetailScreen(album.id, album.name))
        return true
      }
      if (e.key.escape || e.input === 'h') return true
      return false
    },
  }
}
```

このパターン（「Screen ごとに小さな private zustand スライス」）は他の Screen でも使う。

- [ ] **Step 3: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/AlbumsScreen.tsx
git commit -m "feat(screens): AlbumsScreen with paginated load and private cursor slice"
```

---

## Task 5.3: screens/AlbumDetailScreen.tsx + ファクトリ

**Files:**
- Create: `src/screens/AlbumDetailScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/AlbumDetailScreen.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useQueueStore } from '../stores/queue.store'
import { usePlayerStore } from '../stores/player.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import type { Song, Album } from '../types/subsonic'

type DetailState = {
  cursor: number
  album: Album | null
  songs: Song[]
  isLoading: boolean
  set: (s: Partial<DetailState>) => void
}

function makeStore() {
  return create<DetailState>((set) => ({
    cursor: 0,
    album: null,
    songs: [],
    isLoading: false,
    set: (s) => set(s),
  }))
}

function AlbumDetailView({ store, albumId }: { store: ReturnType<typeof makeStore>; albumId: string }) {
  const { subsonic, config } = useServices()
  const { cursor, album, songs, isLoading, set } = store()
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 10)

  useEffect(() => {
    set({ isLoading: true })
    safeLoad(() => subsonic.getAlbum(albumId), 'Failed to load album')
      .then(r => {
        if (r) set({ album: r.album, songs: r.songs, isLoading: false })
        else set({ isLoading: false })
      })
  }, [albumId])

  if (isLoading || !album) {
    return <Text color={config.theme.subtle}>Loading...</Text>
  }

  const total = songs.reduce((acc, s) => acc + s.duration, 0)
  const totalMin = Math.floor(total / 60)
  const totalSec = total % 60

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={config.theme.highlight} bold>{album.name}</Text>
        <Text color={config.theme.subtle}>  ─  {album.artist}  ─  {album.year ?? '----'}</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={config.theme.subtle} dimColor>Esc/h: back</Text>
        </Box>
      </Box>
      <WindowList
        items={songs}
        cursor={cursor}
        height={winHeight}
        renderItem={(song, _i, isCursor) => (
          <SongRow song={song} isCursor={isCursor} isPlaying={false} showAlbum={false}
                   highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
      <Text color={config.theme.subtle}>
        {songs.length} tracks  ·  {totalMin}:{totalSec.toString().padStart(2,'0')}
      </Text>
    </Box>
  )
}

export function makeAlbumDetailScreen(albumId: string, fallbackTitle: string = 'Album'): Screen {
  const store = makeStore()

  return {
    id: `album-detail:${albumId}`,
    title: fallbackTitle,
    render: () => <AlbumDetailView store={store} albumId={albumId} />,
    onKey: (e: KeyEvent) => {
      const s = store.getState()
      const max = s.songs.length - 1

      if (e.input === 'j' || e.key.downArrow) { s.set({ cursor: Math.min(max, s.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { s.set({ cursor: Math.max(0,   s.cursor - 1) }); return true }
      if (e.input === 'g')                    { s.set({ cursor: 0 });   return true }
      if (e.input === 'G')                    { s.set({ cursor: max }); return true }

      if (e.key.return) {
        const song = s.songs[s.cursor]
        if (song) playFromHere(s.cursor, s.songs)
        return true
      }
      if (e.input === 'q') {
        const song = s.songs[s.cursor]
        if (song) useQueueStore.getState().enqueueLast(song)
        return true
      }
      if (e.input === 'Q') {
        s.songs.forEach(song => useQueueStore.getState().enqueueLast(song))
        return true
      }
      if (e.key.escape || e.input === 'h') {
        useNavStore.getState().pop()
        return true
      }
      return false
    },
  }
}

function playFromHere(cursorIdx: number, songs: Song[]) {
  const queue = useQueueStore.getState()
  queue.clear()
  songs.forEach(s => queue.enqueueLast(s))
  queue.jumpTo(cursorIdx)
  // 実再生は ServiceContext.controller.playSong 経由。
  // Screen から直接 controller を呼ぶには render フェーズが必要なので、
  // ここでは player.store と queue.store の更新のみ行い、
  // 実際の loadFile はメインの「キュー変更を監視するエフェクト」が拾う設計に変更する。
  //
  // しかし MVP では複雑性を増やしたくないので、controller を Screen factory に注入する。
  // (Phase 6 の app.tsx で makeAlbumDetailScreen に controller を渡すよう修正)
  const song = songs[cursorIdx]
  if (song) usePlayerStore.getState().setCurrentSong(song)
}
```

注: 上記コメント通り、`playFromHere` は store だけ更新する。実 mpv 再生は Phase 6 で `controller` 経由に書き換える。Screen ファクトリには `(controller: PlaybackController)` 引数を後で追加する。

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/AlbumDetailScreen.tsx
git commit -m "feat(screens): AlbumDetailScreen with songs list (controller wiring deferred)"
```

---

## Task 5.4: screens/ArtistDetailScreen.tsx + ファクトリ

**Files:**
- Create: `src/screens/ArtistDetailScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/ArtistDetailScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import type { Album, Artist } from '../types/subsonic'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'

type State = {
  cursor: number
  artist: Artist | null
  albums: Album[]
  isLoading: boolean
  set: (s: Partial<State>) => void
}

function makeStore() {
  return create<State>((set) => ({
    cursor: 0, artist: null, albums: [], isLoading: false,
    set: (s) => set(s),
  }))
}

function ArtistDetailView({ store, artistId }: { store: ReturnType<typeof makeStore>; artistId: string }) {
  const { subsonic, config } = useServices()
  const { cursor, artist, albums, isLoading, set } = store()
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  useEffect(() => {
    set({ isLoading: true })
    safeLoad(() => subsonic.getArtist(artistId), 'Failed to load artist')
      .then(r => {
        if (r) set({ artist: r.artist, albums: r.albums, isLoading: false })
        else set({ isLoading: false })
      })
  }, [artistId])

  if (isLoading || !artist) {
    return <Text color={config.theme.subtle}>Loading...</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={config.theme.highlight} bold>{artist.name}</Text>
        <Text color={config.theme.subtle}>  ·  {albums.length} albums</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={config.theme.subtle} dimColor>Esc/h: back</Text>
        </Box>
      </Box>
      <WindowList
        items={albums}
        cursor={cursor}
        height={winHeight}
        renderItem={(album, _i, isCursor) => (
          <AlbumRow album={album} isCursor={isCursor}
                    highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeArtistDetailScreen(artistId: string, fallbackTitle: string = 'Artist'): Screen {
  const store = makeStore()
  return {
    id: `artist-detail:${artistId}`,
    title: fallbackTitle,
    render: () => <ArtistDetailView store={store} artistId={artistId} />,
    onKey: (e: KeyEvent) => {
      const s = store.getState()
      const max = s.albums.length - 1
      if (e.input === 'j' || e.key.downArrow) { s.set({ cursor: Math.min(max, s.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { s.set({ cursor: Math.max(0,   s.cursor - 1) }); return true }
      if (e.input === 'g')                    { s.set({ cursor: 0 });   return true }
      if (e.input === 'G')                    { s.set({ cursor: max }); return true }
      if (e.key.return) {
        const album = s.albums[s.cursor]
        if (album) useNavStore.getState().push(makeAlbumDetailScreen(album.id, album.name))
        return true
      }
      if (e.key.escape || e.input === 'h') {
        useNavStore.getState().pop()
        return true
      }
      return false
    },
  }
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/ArtistDetailScreen.tsx
git commit -m "feat(screens): ArtistDetailScreen drilling to AlbumDetail"
```

---

## Task 5.5: screens/QueueScreen.tsx + ファクトリ

**Files:**
- Create: `src/screens/QueueScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/QueueScreen.tsx
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { create } from 'zustand'
import { useQueueStore } from '../stores/queue.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import type { Screen, KeyEvent } from '../framework/Screen'

const useCursor = create<{ cursor: number; set: (n: number) => void }>((set) => ({
  cursor: 0,
  set: (n) => set({ cursor: n }),
}))

function QueueView() {
  const { config } = useServices()
  const items = useQueueStore(s => s.items)
  const currentIndex = useQueueStore(s => s.currentIndex)
  const cursor = useCursor(s => s.cursor)
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 8)

  if (items.length === 0) {
    return <Text color={config.theme.subtle}>Queue is empty.</Text>
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color={config.theme.highlight} bold>
        Queue ({items.length} tracks)
      </Text>
      <Text color={config.theme.subtle} dimColor>
        Enter: jump to song · x: remove · X: clear · Esc: back
      </Text>
      <WindowList
        items={items}
        cursor={cursor}
        height={winHeight}
        renderItem={(song, i, isCursor) => (
          <SongRow song={song} isCursor={isCursor} isPlaying={i === currentIndex}
                   showTrackNumber={false}
                   highlight={config.theme.highlight} subtle={config.theme.subtle} />
        )}
      />
    </Box>
  )
}

export function makeQueueScreen(): Screen {
  return {
    id: 'queue',
    title: 'Queue',
    render: () => <QueueView />,
    onKey: (e: KeyEvent) => {
      const items = useQueueStore.getState().items
      const max = items.length - 1
      const c = useCursor.getState().cursor
      const set = useCursor.getState().set

      if (e.input === 'j' || e.key.downArrow) { set(Math.min(max, c + 1)); return true }
      if (e.input === 'k' || e.key.upArrow)   { set(Math.max(0,   c - 1)); return true }
      if (e.input === 'g')                    { set(0);             return true }
      if (e.input === 'G')                    { set(max);           return true }

      if (e.key.return) {
        const song = items[c]
        if (song) {
          useQueueStore.getState().jumpTo(c)
          // 実 mpv 再生は controller 経由。Phase 6 で配線。
        }
        return true
      }

      if (e.input === 'x') {
        useQueueStore.getState().remove(c)
        const newMax = useQueueStore.getState().items.length - 1
        if (c > newMax) set(Math.max(0, newMax))
        return true
      }

      if (e.input === 'X') {
        useQueueStore.getState().clear()
        set(0)
        return true
      }

      // Esc は Layer 1 タブ切替に任せたいので consume しない
      return false
    },
  }
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/QueueScreen.tsx
git commit -m "feat(screens): QueueScreen with x/X actions"
```

---

## Task 5.6: screens/SearchScreen.tsx + ファクトリ

input/results モードを内包し、Layer 3 のフラグを mount/unmount で操作する。

**Files:**
- Create: `src/screens/SearchScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/SearchScreen.tsx
import React, { useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'
import TextInput from 'ink-text-input'
import { create } from 'zustand'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { WindowList } from '../framework/WindowList'
import { SongRow } from '../components/SongRow'
import { AlbumRow } from '../components/AlbumRow'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import type { SearchResult } from '../types/subsonic'
import { makeAlbumDetailScreen } from './AlbumDetailScreen'
import { makeArtistDetailScreen } from './ArtistDetailScreen'

type Mode = 'input' | 'results'
type Filter = 'songs' | 'albums' | 'artists'

type State = {
  query: string
  mode: Mode
  filter: Filter
  cursor: number
  isLoading: boolean
  results: SearchResult
  set: (s: Partial<State>) => void
}

const useSearchStore = create<State>((set) => ({
  query: '',
  mode: 'input',
  filter: 'songs',
  cursor: 0,
  isLoading: false,
  results: { songs: [], albums: [], artists: [] },
  set: (s) => set(s),
}))

const FILTERS: Filter[] = ['songs', 'albums', 'artists']

function SearchView() {
  const { subsonic, config } = useServices()
  const st = useSearchStore()
  const { stdout } = useStdout()
  const winHeight = Math.max(5, (stdout.rows ?? 30) - 10)
  const setNavInput = useNavStore.getState().setTextInputFocused

  // Mount: input モードならフォーカスフラグを立てる
  useEffect(() => {
    setNavInput(st.mode === 'input')
    return () => setNavInput(false)
  }, [st.mode])

  // クエリが変わったら 300ms デバウンスして検索
  useEffect(() => {
    if (!st.query.trim()) {
      st.set({ results: { songs: [], albums: [], artists: [] } })
      return
    }
    const timer = setTimeout(async () => {
      st.set({ isLoading: true })
      const r = await safeLoad(() => subsonic.search(st.query), 'Search failed')
      if (r) st.set({ results: r, cursor: 0, isLoading: false })
      else   st.set({ isLoading: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [st.query])

  const list = st.results[st.filter]

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        <Text color={st.mode === 'input' ? config.theme.highlight : config.theme.subtle}>/ </Text>
        {st.mode === 'input' ? (
          <TextInput
            value={st.query}
            onChange={(v) => st.set({ query: v })}
            onSubmit={() => {
              if (list.length > 0) st.set({ mode: 'results', cursor: 0 })
            }}
            placeholder="Search..."
            focus={true}
          />
        ) : (
          <Text color={config.theme.subtle}>{st.query}</Text>
        )}
      </Box>

      <Box>
        {FILTERS.map((f) => {
          const isActive = f === st.filter
          return (
            <Box key={f} marginRight={2}>
              <Text color={isActive ? config.theme.highlight : config.theme.subtle} underline={isActive}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({st.results[f].length})
              </Text>
            </Box>
          )
        })}
      </Box>

      {st.isLoading && <Text color={config.theme.subtle}>Searching...</Text>}

      {st.mode === 'results' && (
        <WindowList
          items={list as any[]}
          cursor={st.cursor}
          height={winHeight}
          renderItem={(item, _i, isCursor) => {
            if (st.filter === 'songs') {
              return <SongRow song={item} isCursor={isCursor} isPlaying={false} showAlbum
                              highlight={config.theme.highlight} subtle={config.theme.subtle} />
            }
            if (st.filter === 'albums') {
              return <AlbumRow album={item} isCursor={isCursor}
                              highlight={config.theme.highlight} subtle={config.theme.subtle} />
            }
            return (
              <Text color={isCursor ? config.theme.highlight : config.theme.subtle} inverse={isCursor}>
                {isCursor ? '▶ ' : '  '}{(item as any).name}  ·  {(item as any).albumCount} albums
              </Text>
            )
          }}
        />
      )}

      {st.mode === 'results' && (
        <Text color={config.theme.subtle} dimColor>
          j/k: move · Enter: open · Tab: filter · /: input · Esc: input
        </Text>
      )}
    </Box>
  )
}

export function makeSearchScreen(): Screen {
  return {
    id: 'search',
    title: 'Search',
    render: () => <SearchView />,
    onKey: (e: KeyEvent) => {
      const st = useSearchStore.getState()

      // input モード: KeyRouter は Esc 以外を Layer 3 で遮断するため、
      // ここに来るのは Esc のみ
      if (st.mode === 'input') {
        if (e.key.escape) {
          // クエリが空なら無視、空でなければ results へ（あれば）
          const list = st.results[st.filter]
          if (list.length > 0) st.set({ mode: 'results' })
          return true
        }
        return false
      }

      // results モード
      const list = st.results[st.filter]
      const max = list.length - 1

      if (e.input === '/' || e.key.escape) {
        st.set({ mode: 'input' })
        return true
      }

      if (e.key.tab) {
        const idx = FILTERS.indexOf(st.filter)
        const next = FILTERS[(idx + (e.key.shift ? -1 + FILTERS.length : 1)) % FILTERS.length]
        st.set({ filter: next, cursor: 0 })
        return true
      }

      if (e.input === 'j' || e.key.downArrow) { st.set({ cursor: Math.min(max, st.cursor + 1) }); return true }
      if (e.input === 'k' || e.key.upArrow)   { st.set({ cursor: Math.max(0,   st.cursor - 1) }); return true }

      if (e.key.return) {
        const item: any = list[st.cursor]
        if (!item) return true
        if (st.filter === 'songs') {
          // controller 経由再生は Phase 6 で配線
          return true
        }
        if (st.filter === 'albums') {
          useNavStore.getState().push(makeAlbumDetailScreen(item.id, item.name))
          return true
        }
        if (st.filter === 'artists') {
          useNavStore.getState().push(makeArtistDetailScreen(item.id, item.name))
          return true
        }
      }

      return false
    },
  }
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/SearchScreen.tsx
git commit -m "feat(screens): SearchScreen with input/results modes"
```

---

## Task 5.7: screens/NowPlayingScreen.tsx + ファクトリ

**Files:**
- Create: `src/screens/NowPlayingScreen.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/screens/NowPlayingScreen.tsx
import React, { useEffect, useState } from 'react'
import { Box, Text, useStdout } from 'ink'
import { usePlayerStore } from '../stores/player.store'
import { useNavStore } from '../stores/nav.store'
import { useServices } from '../framework/ServiceContext'
import { AlbumArt } from '../components/AlbumArt'
import { ProgressBar } from '../components/ProgressBar'
import { safeLoad } from '../framework/safeLoad'
import type { Screen, KeyEvent } from '../framework/Screen'
import type { StructuredLyrics } from '../types/subsonic'

function NowPlayingView() {
  const { subsonic, config } = useServices()
  const currentSong = usePlayerStore(s => s.currentSong)
  const position = usePlayerStore(s => s.position)
  const duration = usePlayerStore(s => s.duration)
  const [lyrics, setLyrics] = useState<StructuredLyrics | null>(null)
  const { stdout } = useStdout()
  const termWidth = stdout.columns ?? 80

  useEffect(() => {
    if (!currentSong) { setLyrics(null); return }
    safeLoad(() => subsonic.getLyrics(currentSong.id), 'Failed to load lyrics').then(setLyrics)
  }, [currentSong?.id])

  if (!currentSong) {
    return (
      <Box padding={2} flexDirection="column">
        <Text color={config.theme.subtle}>No track playing</Text>
        <Text color={config.theme.subtle} dimColor>M / Esc to close</Text>
      </Box>
    )
  }

  const coverArtUrl = subsonic.coverArtUrl(currentSong.albumId, 300)
  const artSize = Math.min(Math.floor(termWidth * 0.3), 300)

  const currentLine = lyrics?.synced
    ? [...(lyrics.lines ?? [])].reverse().find(l => l.start / 1000 <= position)?.value
    : null

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={config.theme.highlight}>
      <Text color={config.theme.highlight} bold> Now Playing</Text>
      <Box gap={2} marginTop={1}>
        <AlbumArt coverArtUrl={coverArtUrl} pixelSize={artSize} />
        <Box flexDirection="column" flexGrow={1} gap={1}>
          <Text color="#ffffff" bold>{currentSong.title}</Text>
          <Text color={config.theme.subtle}>{currentSong.artist}</Text>
          <Text color={config.theme.subtle}>
            {currentSong.album}{currentSong.year ? ` (${currentSong.year})` : ''}
          </Text>
          <ProgressBar position={position} duration={duration} width={30} color={config.theme.highlight} />
          {currentLine && (
            <Box marginTop={1}>
              <Text color={config.theme.highlight} italic>{currentLine}</Text>
            </Box>
          )}
        </Box>
      </Box>
      <Text color={config.theme.subtle} dimColor> M / Esc to close</Text>
    </Box>
  )
}

export function makeNowPlayingScreen(): Screen {
  return {
    id: 'now-playing',
    title: 'Now Playing',
    isModal: true,
    render: () => <NowPlayingView />,
    onKey: (e: KeyEvent) => {
      if (e.key.escape || e.input === 'M') {
        useNavStore.getState().closeModal()
        return true
      }
      return false
    },
  }
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/NowPlayingScreen.tsx
git commit -m "feat(screens): NowPlayingScreen modal with lyrics"
```

---

# Phase 6: App Wiring

## Task 6.1: defaults.ts のキーバインドを Layer 1/2 に分割

**Files:**
- Modify: `src/config/defaults.ts`

- [ ] **Step 1: keybinds セクションを書き換え**

`src/config/defaults.ts` の `keybinds` を以下に置き換える：

```typescript
keybinds: {
  // Layer 1: Always-on global
  global: {
    play_pause:        ['space'],
    next:              ['n'],
    prev:              ['p'],
    volume_up:         ['+', '='],
    volume_down:       ['-'],
    rewind:            ['<'],
    forward:           ['>'],
    restart:           ['.'],
    loop:              ['l'],
    toggle_now_playing:['M'],
    tab_next:          ['tab'],
    tab_prev:          ['S-tab'],
    tab_1:             ['1'],
    tab_2:             ['2'],
    tab_3:             ['3'],
    search_jump:       ['/'],
    quit:              ['Z'],
  },
  // Layer 2: Common screen-local
  navigation: {
    up:     ['k', 'up'],
    down:   ['j', 'down'],
    top:    ['g'],
    bottom: ['G'],
    select: ['return'],
    back:   ['escape', 'h'],
  },
}
```

- [ ] **Step 2: 既存 keybinds.test.ts が pass するか確認**

```bash
bun test tests/unit/keybinds.test.ts
```

- [ ] **Step 3: コミット**

```bash
git add src/config/defaults.ts
git commit -m "feat(config): split keybinds into global (Layer 1) / navigation (Layer 2)"
```

---

## Task 6.2: app.tsx のスケルトン（Login / Loading フロー）

**Files:**
- Create: `src/app.tsx`

- [ ] **Step 1: 実装**

```typescript
// src/app.tsx
import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { LoginScreen } from './screens/LoginScreen'
import { loadConfig, loadCredentials, saveCredentials } from './config/config'
import type { AppConfig, Credentials } from './types/config'

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

function MainApp(_props: { config: AppConfig; creds: Credentials; onAuthError: (msg: string) => void }) {
  // Phase 6.3 で実装
  return <Text>MainApp placeholder</Text>
}
```

- [ ] **Step 2: main.tsx を更新**

```tsx
// src/main.tsx
import React from 'react'
import { render } from 'ink'
import { App } from './app'

const { unmount } = render(<App />, { patchConsole: true })

process.on('SIGTERM', () => { unmount(); process.exit(0) })
process.on('SIGINT', () => { unmount(); process.exit(0) })
```

- [ ] **Step 3: 型チェック・起動確認**

```bash
bun run typecheck
```

- [ ] **Step 4: コミット**

```bash
git add src/app.tsx src/main.tsx
git commit -m "feat(app): skeleton with phase-based Login/Main split"
```

---

## Task 6.3: MainApp と Layer 1 ハンドラ（playbackController）

**Files:**
- Modify: `src/app.tsx`

- [ ] **Step 1: MainApp の実装**

`src/app.tsx` の `MainApp` placeholder を以下に置き換え：

```typescript
import { useRef, useState, useEffect, useCallback } from 'react'
import { Box, Text } from 'ink'
import { SubsonicClient, isAuthError } from './services/subsonic'
import { MpvClient } from './services/mpv'
import { ScrobbleService } from './services/scrobble'
import { sendNowPlayingNotification } from './services/notify'
import { ServiceProvider, type Services, type PlaybackController } from './framework/ServiceContext'
import { KeyRouter } from './framework/KeyRouter'
import { useNavStore } from './stores/nav.store'
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
import type { Song } from './types/subsonic'
import type { KeyEvent } from './framework/Screen'

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

      const scrobble = new ScrobbleService((id, opts) => subsonic.scrobble(id, opts))

      // playbackController
      const playSong = async (song: Song) => {
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

      // 曲終了の自動次曲（loopMode 考慮）
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
        else  usePlayerStore.getState().syncFromMpv({ paused: true, position: 0, duration: 0, volume: usePlayerStore.getState().volume, path: null })
      })

      // mpv 状態 polling と respawn
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
  if (e.input === ' ') return controller.togglePause()
  if (e.input === 'n') return controller.next()
  if (e.input === 'p') return controller.prev()
  if (e.input === '+' || e.input === '=') return controller.volumeDelta(+5)
  if (e.input === '-') return controller.volumeDelta(-5)
  if (e.input === '<') return controller.seekRelative(-10)
  if (e.input === '>') return controller.seekRelative(+10)
  if (e.input === '.') return controller.seekTo(0)
  if (e.input === 'l') return controller.toggleLoopMode()
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
    nav.setTab(order[(idx + (e.key.shift ? -1 + order.length : 1)) % order.length])
    return
  }
  if (e.input === '1') return useNavStore.getState().setTab('library')
  if (e.input === '2') return useNavStore.getState().setTab('queue')
  if (e.input === '3') return useNavStore.getState().setTab('search')
  if (e.input === '/') {
    const nav = useNavStore.getState()
    nav.setTab('search')
    // input モードへ強制遷移は SearchScreen 側のロジックで
    return
  }
}

function ScreenHost() {
  const activeTab = useNavStore(s => s.activeTab)
  const stacks = useNavStore(s => s.stacks)
  const modal = useNavStore(s => s.modal)
  const config = useServices().config

  const top = stacks[activeTab][stacks[activeTab].length - 1]
  const screen = modal ?? top

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <TabBar highlight={config.theme.highlight} subtle={config.theme.subtle} />
      <Box flexGrow={1} paddingX={1}>
        {screen ? screen.render() : <Text>(empty)</Text>}
      </Box>
      <PlayerBar />
      <StatusLine />
    </Box>
  )
}

import { useServices } from './framework/ServiceContext'
import type { Tab } from './stores/nav.store'
```

注: import 文の整理は最後に行う（最終形では先頭にまとめる）。

- [ ] **Step 2: AlbumDetailScreen / SearchScreen の controller 経由再生を有効化**

これらの Screen は `playFromHere` を「store 更新のみ」にしていた。controller を呼ぶように修正：

`AlbumDetailScreen.tsx` の `onKey` の Enter 処理：

```typescript
if (e.key.return) {
  const song = s.songs[s.cursor]
  if (song) {
    const queue = useQueueStore.getState()
    queue.clear()
    s.songs.forEach(x => queue.enqueueLast(x))
    queue.jumpTo(s.cursor)
    // controller を呼ぶには ServiceContext が必要。Screen の onKey は React 外なので、
    // 代替として「currentPlay request」をトリガーする set を発行する。
    // ここでは window グローバルにイベントを emit する簡易な方式を使う：
    triggerPlay(song)
  }
  return true
}
```

`SearchScreen.tsx` の Enter on song:

```typescript
if (st.filter === 'songs') {
  const song = item
  triggerPlay(song)
  return true
}
```

`QueueScreen.tsx` の Enter:

```typescript
if (e.key.return) {
  useQueueStore.getState().jumpTo(c)
  const song = useQueueStore.getState().items[c]
  if (song) triggerPlay(song)
  return true
}
```

`triggerPlay` は次のヘルパとして `framework/ServiceContext.tsx` に追加する：

```typescript
// framework/ServiceContext.tsx の末尾に追加
let _controller: PlaybackController | null = null

export function setGlobalController(c: PlaybackController | null) {
  _controller = c
}

export function triggerPlay(song: import('../types/subsonic').Song) {
  _controller?.playSong(song)
}
```

そして `app.tsx` の `MainApp` 内で controller 生成直後に `setGlobalController(controller)` を呼ぶ。Cleanup 時に `setGlobalController(null)`。

- [ ] **Step 3: import を整理**

`src/app.tsx` のすべての import をファイル冒頭に集約。重複や順序を整える。

- [ ] **Step 4: 型チェック**

```bash
bun run typecheck
```

- [ ] **Step 5: コミット**

```bash
git add src/app.tsx src/framework/ServiceContext.tsx src/screens/AlbumDetailScreen.tsx src/screens/SearchScreen.tsx src/screens/QueueScreen.tsx
git commit -m "feat(app): MainApp with services init, KeyRouter, playbackController, end-file handling"
```

---

## Task 6.4: 起動確認とエラー回復のスモークテスト

- [ ] **Step 1: ターミナルで起動して Login 画面確認**

```bash
bun run src/main.tsx
```

Expected: Login 画面が表示される（credentials がない場合）または直接 Albums 画面が表示される。`Ctrl+C` で終了。

- [ ] **Step 2: 既存テストすべて pass を確認**

```bash
bun test
```

Expected: 全 unit + integration tests pass

- [ ] **Step 3: コミット（Smoke 通過の記録）**

このステップでコード変更がなければコミットしない。コードを微修正したらコミット。

---

## Task 6.5: Layer 1 で `/` 押下時に Search を input モードに戻す

`/` キーで Search タブへジャンプしたら、SearchScreen の mode を 'input' に強制したい。これは `SearchScreen.tsx` 側で「activeTab が search に切り替わった時 mode='input' にする」ロジックを追加して実現する。

**Files:**
- Modify: `src/screens/SearchScreen.tsx`

- [ ] **Step 1: SearchScreen にタブ切替時の reset を追加**

`SearchView` の `useEffect` 群に追加：

```typescript
const activeTab = useNavStore(s => s.activeTab)
useEffect(() => {
  if (activeTab === 'search') {
    // タブにフォーカスが来るたび input モードに戻す（query は維持）
    useSearchStore.getState().set({ mode: 'input', cursor: 0 })
  }
}, [activeTab])
```

- [ ] **Step 2: 型チェック・コミット**

```bash
bun run typecheck
git add src/screens/SearchScreen.tsx
git commit -m "feat(search): reset to input mode when search tab activated"
```

---

# Phase 7: Testing & QA

## Task 7.1: tests/integration/screen-stack.test.ts

**Files:**
- Create: `tests/integration/screen-stack.test.ts`

- [ ] **Step 1: テストを実装**

```typescript
// tests/integration/screen-stack.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { useNavStore } from '../../src/stores/nav.store'
import type { Screen } from '../../src/framework/Screen'

const mk = (id: string): Screen => ({ id, title: id, render: () => null })

describe('screen-stack flow', () => {
  beforeEach(() => {
    useNavStore.setState({
      activeTab: 'library',
      stacks: { library: [mk('albums')], queue: [mk('queue')], search: [mk('search')] },
      modal: null,
      textInputFocused: false,
    })
  })

  test('Albums で Enter (push) → AlbumDetail がトップ', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
  })

  test('AlbumDetail で Esc (pop) → Albums に戻る', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    expect(useNavStore.getState().pop()).toBe(true)
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums'])
  })

  test('Search → Artist → Album の3階層 push', () => {
    useNavStore.getState().setTab('search')
    useNavStore.getState().push(mk('artist-detail:9'))
    useNavStore.getState().push(mk('album-detail:42'))
    expect(useNavStore.getState().stacks.search.map(s => s.id)).toEqual(['search', 'artist-detail:9', 'album-detail:42'])
  })

  test('Esc 連打で順次戻る', () => {
    useNavStore.getState().setTab('search')
    useNavStore.getState().push(mk('artist-detail:9'))
    useNavStore.getState().push(mk('album-detail:42'))
    expect(useNavStore.getState().pop()).toBe(true)  // album → artist
    expect(useNavStore.getState().pop()).toBe(true)  // artist → search
    expect(useNavStore.getState().pop()).toBe(false) // root
    expect(useNavStore.getState().stacks.search.map(s => s.id)).toEqual(['search'])
  })

  test('タブ切替でスタックは保持される', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    useNavStore.getState().setTab('queue')
    useNavStore.getState().setTab('library')
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
  })

  test('モーダルはスタックと独立', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    useNavStore.getState().openModal(mk('now-playing'))
    expect(useNavStore.getState().modal?.id).toBe('now-playing')
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
    useNavStore.getState().closeModal()
    expect(useNavStore.getState().modal).toBeNull()
  })
})
```

- [ ] **Step 2: テスト合格確認**

```bash
bun test tests/integration/screen-stack.test.ts
```

Expected: 6 tests pass

- [ ] **Step 3: コミット**

```bash
git add tests/integration/screen-stack.test.ts
git commit -m "test(integration): screen stack flow"
```

---

## Task 7.2: 型チェック + 全テスト

- [ ] **Step 1: typecheck**

```bash
bun run typecheck
```

Expected: エラーなし

- [ ] **Step 2: 全テスト実行**

```bash
bun test
```

Expected: 全 pass。失敗があれば修正。

- [ ] **Step 3: 修正があればコミット**

---

## Task 7.3: 手動 QA チェックリスト

実機で `bun run src/main.tsx` を実行して以下を確認。

- [ ] **起動**
  - [ ] credentials なし → LoginScreen 表示
  - [ ] 不正 credentials → LoginScreen + エラー
  - [ ] 正常起動 → Albums リストが表示される（newest 順）

- [ ] **再生（基本）**
  - [ ] Albums で `j`/`k` でカーソル移動
  - [ ] アルバムを `Enter` → AlbumDetail に push（曲一覧表示）
  - [ ] AlbumDetail で `Enter` → 再生開始 + キュー充填
  - [ ] PlayerBar に曲名・進捗が表示される
  - [ ] `Space` で一時停止 / 再生
  - [ ] `n` で次曲、`p` で前曲
  - [ ] `+`/`-` でボリューム変動（PlayerBar に反映）
  - [ ] `<`/`>` で ±10 秒シーク
  - [ ] `.` で曲の先頭
  - [ ] `M` で NowPlaying モーダル開閉
  - [ ] `M` 押下中も Layer 1 が（NowPlaying は isModal）抑制されることを確認

- [ ] **ループ**
  - [ ] `l` でループモードを none → all → one
  - [ ] all モードでキュー末尾の曲が終わったら先頭に戻る
  - [ ] one モードで同じ曲がリピート
  - [ ] none モードでキュー末尾後に停止

- [ ] **キュー操作**
  - [ ] AlbumDetail で `q` → 1 曲をキュー末尾に追加
  - [ ] AlbumDetail で `Q` → アルバム全体をキュー末尾に追加
  - [ ] Queue タブで `x` → 1 行削除
  - [ ] Queue タブで `X` → クリア
  - [ ] Queue タブで `Enter` → その曲にジャンプして再生

- [ ] **検索（Search タブ）**
  - [ ] `3` または `Tab` で Search タブへ
  - [ ] `/` 押下でも Search タブ + input モード
  - [ ] 文字入力で 300ms デバウンスして検索
  - [ ] `Enter` で results モードに遷移
  - [ ] `j/k` でカーソル移動
  - [ ] `Tab` で filter 切替（Songs/Albums/Artists）
  - [ ] Songs を `Enter` → 再生
  - [ ] Albums を `Enter` → AlbumDetail に push
  - [ ] Artists を `Enter` → ArtistDetail（その人のアルバム一覧）に push
  - [ ] ArtistDetail で album を `Enter` → AlbumDetail に push
  - [ ] `Esc` 連打でルートまで戻る
  - [ ] results モードで `/` を押すと input モードに戻る

- [ ] **タブ切替**
  - [ ] `Tab` / `Shift+Tab` で順送り / 逆送り
  - [ ] `1`/`2`/`3` で直接ジャンプ
  - [ ] タブ切替してもスタックが保持される

- [ ] **スクロブル（要 Last.fm 連携サーバー）**
  - [ ] 曲再生開始後すぐに Last.fm の Now Playing が更新される（外部確認）
  - [ ] 曲が完了時刻に到達すると scrobble される
  - [ ] スキップしても scrobble されない

- [ ] **エラー処理**
  - [ ] サーバーを停止 → StatusLine に警告
  - [ ] 数秒待つと自動消去
  - [ ] サーバー再起動 → 次の操作で正常動作

- [ ] **終了**
  - [ ] `Z Z`（300ms 以内のダブルタップ）で正常終了
  - [ ] `Ctrl+C` で強制終了
  - [ ] mpv プロセスが残らない（ps で確認）

- [ ] **すべて OK ならコミット（QA log）**

```bash
git commit --allow-empty -m "qa: manual QA checklist passed for v2 MVP"
```

---

## 実装完了後

すべての Phase が完了し、QA チェックリストが pass したら以下を実行：

1. **PR を作成（任意）**
   ```bash
   git push -u origin feat/redesign-v2
   gh pr create --title "feat: SubTSUI v2 redesign (MVP)" --body "..."
   ```

2. **main にマージ後、v1 ブランチを削除**
   ```bash
   git checkout main
   git merge feat/redesign-v2
   git branch -D feat/tui-player
   ```

3. **steering / spec / plan ドキュメントは保持**（次回拡張時の参照点）。完了済みのタスクはチェックボックスで状態が残る。

---

## Self-Review

このプランを書き終えた後、以下をチェック済み：

**Spec 準拠:**
- ✅ Phase 1〜5 の順序を踏襲
- ✅ 削除ファイル / 流用ファイル一覧が仕様書と一致
- ✅ 3 層キーボードルーティングを framework/keyRouter で実装
- ✅ Screen 抽象は spec のインターフェースに準拠
- ✅ ストア境界・独立性原則を反映
- ✅ シナリオ A〜E のフローを app.tsx で実装
- ✅ エラー処理（safeLoad, status.store, MPV respawn）を反映
- ✅ 必須テスト 3 種（keyrouter, nav.store, screen-stack）を追加

**プレースホルダーなし:**
- TBD / TODO は本文に登場しない
- 各ステップに具体的なコード or コマンドがある

**型整合:**
- `Screen.onKey` 戻り値（`boolean`）を全 Screen で統一
- `nav.store` の型定義と各 Screen のファクトリの引数型が一致
- `useServices()` を呼ぶ場所が必ず `<ServiceProvider>` 配下である

不明点があれば実装途中で plan 自体を更新（チェックボックス + 追記）してよい。
