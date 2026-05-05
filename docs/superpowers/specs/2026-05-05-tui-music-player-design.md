# TUI 音楽プレイヤー設計仕様

**日付:** 2026-05-05
**対象:** SubTUI の TypeScript 書き直し
**アプリ名:** 未定（実装開始前に決定すること。本文中の `<appname>` はすべてその名前に置き換える）
**ステータス:** 承認済み

---

## 背景と目的

SubTUI（Go + Bubble Tea 製の Subsonic API TUI 音楽プレイヤー）を TypeScript で 1 から書き直す。
主な改善目標：

- **Last.fm Now Playing が反映されないバグの修正**（Subsonic スクロブルの Now Playing / 完了タイミングを正確に実装）
- **UI/UX の改善**（タブ型フルワイドレイアウト、アルバムアート高画質表示）
- SubTUI の 107 フィールド god object を解体し、保守性を高める

---

## 技術スタック

| 役割 | 採用技術 | 理由 |
|---|---|---|
| ランタイム | **Bun** | ネイティブ TypeScript 実行、高速起動、npm 互換 |
| UI フレームワーク | **Ink v5（React）** | コンポーネント分割で god object を解体、宣言的 UI |
| 状態管理 | **Zustand** | スライス分割、React との相性◎、ボイラープレート少 |
| オーディオ | **MPV**（subprocess + Unix IPC ソケット） | 実績あり、gapless / ReplayGain 対応 |
| 画像表示 | **Kitty graphics protocol**（フォールバックチェーン付き） | WezTerm で最高画質 |
| 設定形式 | **TOML** | SubTUI 互換、人間が読みやすい |
| テスト | **Bun test** | ビルトイン、設定不要 |

---

## プロジェクト構造

```
src/
  main.tsx                      # エントリポイント
  app.tsx                       # ルートコンポーネント（タブルーティング）

  components/
    layout/
      TabBar.tsx                # Library | Queue | Search | Settings
      PlayerBar.tsx             # フッター（サムネイル + 再生情報 + ボリューム）
      NowPlayingOverlay.tsx     # M キーで開閉する大画面オーバーレイ
    screens/
      LibraryScreen.tsx         # メインライブラリ
      QueueScreen.tsx           # キュー管理
      SearchScreen.tsx          # 検索
      SettingsScreen.tsx        # 設定 UI
    shared/
      SongTable.tsx             # 共通ソングテーブル
      AlbumArt.tsx              # 画像プロトコル自動選択レンダラー
      ProgressBar.tsx           # 再生進捗バー

  stores/
    player.store.ts             # 再生状態・ボリューム・ループモード・ポジション
    library.store.ts            # 楽曲・アルバム・アーティスト・プレイリスト
    queue.store.ts              # キュー・現在インデックス
    ui.store.ts                 # アクティブタブ・フォーカス・オーバーレイ表示状態

  services/
    subsonic.ts                 # Subsonic REST API クライアント
    mpv.ts                      # MPV IPC クライアント
    scrobble.ts                 # スクロブルタイミング管理
    image.ts                    # 画像プロトコル検出・変換
    notify.ts                   # デスクトップ通知

  config/
    config.ts                   # TOML 設定ロード・マージ
    keybinds.ts                 # キーバインドシステム

  types/
    subsonic.d.ts
    player.d.ts

tests/
  unit/
    scrobble.test.ts
    queue.test.ts
    config.test.ts
    keybinds.test.ts
    image.test.ts
  integration/
    subsonic.test.ts
    mpv.test.ts
```

---

## UI レイアウト

タブ型フルワイドレイアウト（サイドバーなし）。

```
┌─[Library]─[Queue]─[Search]─[Settings]──────────────────────┐
│                                                              │
│  🎵 All Songs  Albums  Artists  Playlists  Starred ★        │
│                                                              │
│  #   TITLE              ARTIST        ALBUM        YEAR  ★  │
│  ▶   Midnight City      M83           Hurry Up     2011  ★5 │
│      Intro              The xx        xx           2009  ★4 │
│    ▌ Crystalised        The xx        xx           2009  ★3 │
│      Islands            The xx        xx           2009  ★3 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 🖼  ▶  Midnight City — M83    ████████░░░░  1:23/4:05  🔊85 │
└──────────────────────────────────────────────────────────────┘
```

- フッター左端：アルバムアートサムネイル（常時表示）
- `M` キー：Now Playing オーバーレイ（大きいアートワーク + 歌詞 + 詳細情報）

---

## 状態管理（Zustand スライス）

```typescript
// stores/player.store.ts
type PlayerStore = {
  status: 'playing' | 'paused' | 'stopped'
  currentSong: Song | null
  position: number        // 秒
  duration: number        // 秒
  volume: number          // 0-100
  loopMode: 'none' | 'all' | 'one'
  togglePause: () => void
  setVolume: (v: number) => void
  seek: (delta: number) => void
  syncFromMpv: (status: MpvStatus) => void
}

// stores/library.store.ts
type LibraryStore = {
  view: 'songs' | 'albums' | 'artists' | 'playlists' | 'starred'
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  playlists: Playlist[]
  cursor: number
  pageOffset: number
  isLoading: boolean
  setView: (v: LibraryView) => void
  loadAlbum: (id: string) => Promise<void>
  loadArtist: (id: string) => Promise<void>
  toggleStar: (id: string, type: 'song' | 'album' | 'artist') => void
}

// stores/queue.store.ts
type QueueStore = {
  items: Song[]
  currentIndex: number
  enqueueNext: (song: Song) => void
  enqueueLast: (song: Song) => void
  remove: (index: number) => void
  clear: () => void
  moveUp: (index: number) => void
  moveDown: (index: number) => void
  next: () => Song | null
  prev: () => Song | null
}

// stores/ui.store.ts
type UiStore = {
  activeTab: 'library' | 'queue' | 'search' | 'settings'
  showNowPlaying: boolean
  showHelp: boolean
  showPlaylists: boolean
  searchQuery: string
  searchFilter: 'songs' | 'albums' | 'artists'
}
```

スライス間の直接依存は持たない。`queue.next()` の結果を受け取った呼び出し側が `player.syncFromMpv()` を呼ぶ形で連携する。

---

## スクロブル仕様（Last.fm 標準準拠）

```typescript
// services/scrobble.ts

class ScrobbleService {
  private timer: Timer | null = null

  onSongStart(song: Song) {
    this.cancelPending()

    // 30秒未満はスクロブル対象外（Last.fm 仕様）
    if (song.duration < 30) return

    const startedAt = Date.now()  // 再生開始時刻を記録

    // ① 即座に Now Playing を通知（SubTUI のバグを修正）
    subsonic.scrobble(song.id, { submission: false })

    // ② 完了スクロブルのタイマー（Last.fm 標準: 50% または 240秒の早い方）
    const threshold = Math.min(song.duration * 0.5, 240) * 1000
    this.timer = setTimeout(() => {
      subsonic.scrobble(song.id, {
        submission: true,
        time: startedAt,   // タイマー発火時刻ではなく再生開始時刻を使う
      })
    }, threshold)
  }

  onSongSkip() {
    // しきい値前のスキップ → スクロブルしない
    this.cancelPending()
  }

  private cancelPending() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
```

**スクロブルフロー：**

```
曲再生開始
  ├─→ duration < 30秒 → 何もしない
  ├─→ /scrobble?submission=false  ← Now Playing（即時）
  └─→ タイマー開始（min(duration×50%, 240s)）
        ├─ タイマー到達 → /scrobble?submission=true
        └─ スキップ → タイマーキャンセル
```

スクロブル失敗はサイレント無視（再生を止めない）。

---

## アルバムアート・画像レンダリング

**プロトコルフォールバックチェーン：**

```typescript
// services/image.ts

type ImageProtocol = 'kitty' | 'iterm2' | 'sixel' | 'blocks'

function detectProtocol(): ImageProtocol {
  const term = process.env.TERM_PROGRAM ?? ''
  const termName = process.env.TERM ?? ''

  if (term === 'WezTerm')          return 'kitty'
  if (term === 'iTerm.app')        return 'iterm2'
  if (term === 'ghostty')          return 'kitty'
  if (termName.includes('kitty'))  return 'kitty'
  if (supportsSixel())             return 'sixel'
  return 'blocks'
}
```

| プロトコル | WezTerm 画質 |
|---|---|
| Kitty | ★★★★★ ピクセル完全一致 |
| iTerm2 | ★★★★☆ |
| Sixel | ★★★☆☆ |
| Unicode ブロック | ★★☆☆☆（SubTUI 現状） |

**表示箇所：**
- `PlayerBar`：フッターに小サムネイル（約 32px、常時表示）
- `NowPlayingOverlay`：M キー展開時に大サイズ（最大 300px、ターミナル幅に応じて調整）

**キャッシュ：** LRU キャッシュ、上限 20 枚。Subsonic `/getCoverArt?id=X&size=300` で取得。

---

## キーバインド

**タブナビゲーション：**

| キー | 動作 |
|---|---|
| `Tab` / `Shift+Tab` | タブ切り替え |
| `1` `2` `3` `4` | タブ直接ジャンプ |
| `/` | Search タブへジャンプ |

**Library タブ内：**

| キー | 動作 |
|---|---|
| `f` / `F` | フィルタ切り替え（Songs / Albums / Artists / Playlists / Starred） |
| `j` / `k` | カーソル移動 |
| `Enter` | 選択・再生 |
| `Shift+Enter` | シャッフル再生 |
| `g g` / `G` | 先頭 / 末尾 |
| `a` | 曲からアルバムへジャンプ |
| `r` | 曲からアーティストへジャンプ |

**再生操作（全タブ共通）：**

| キー | 動作 |
|---|---|
| `Space` | 再生 / 一時停止 |
| `n` / `p` | 次 / 前の曲 |
| `l` | ループモード切り替え（none → all → one） |
| `S` | シャッフル |
| `<` / `>` | ±10秒シーク |
| `.` | 曲の先頭に戻る |
| `+` / `-` | ボリューム ±5 |
| `M` | Now Playing オーバーレイ開閉 |

**キュー / その他：**

| キー | 動作 |
|---|---|
| `q` | キューの末尾に追加 |
| `Q` | キューの次に追加 |
| `x` / `X` | キューから削除 / クリア |
| `*` | スター（お気に入り）トグル |
| `R` | レーティング設定（0〜5） |
| `P` | プレイリストに追加 |
| `?` | ヘルプオーバーレイ |
| `Esc` | 戻る / オーバーレイを閉じる |
| `Z Z` | 終了（大文字ダブルタップ、`q` との衝突を避けるため） |
| `Ctrl+c` | 強制終了 |

> **注**: `q`（キュー追加）と終了キーの衝突を避けるため、終了は `Z Z`（300ms 以内のダブルタップ）とする。SubTUI の `q q` から変更。

すべてのキーバインドは `~/.config/<appname>/config.toml` で上書き可能。

---

## 設定・認証システム

**設定ファイル構成（`~/.config/<appname>/`）：**

```toml
# config.toml（パーミッション 0644）
[app]
default_volume    = 80
gapless_playback  = "yes"
replaygain        = "track"
notifications     = true

[theme]
highlight  = "#7dd3fc"
subtle     = "#6b7280"
special    = "#f472b6"

[filters]
min_duration      = 0
titles            = []
genres            = []
exclude_favorites = false

[columns.songs]
track_number = true
title        = true
artist       = true
album        = true
year         = true
rating       = true
duration     = true

[keybinds.playback]
play_pause = ["space"]
next       = ["n"]
prev       = ["p"]
volume_up  = ["+", "="]
volume_down = ["-"]
```

```toml
# credentials.toml（パーミッション 0600）
[server]
url         = "https://your-subsonic-server.com"
auth_method = "plaintext"    # plaintext / hashed / api_key
username    = "user"
password    = "pass"
```

**設定ロードの流れ：**
1. CLI フラグ `-c <path>` または環境変数を確認
2. なければ `~/.config/<appname>/` を使用
3. ファイルが存在しない → 埋め込みデフォルト設定を書き出して起動
4. ユーザー設定とデフォルトをディープマージ（新バージョンのキーを自動補完）
5. `credentials.toml` が未設定 → ログイン画面を表示

---

## エラーハンドリング

**API リトライ（ネットワーク障害のみ）：**

```typescript
async function request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new SubsonicError(res.status, res.statusText, attempt < 2)
      const json = await res.json()
      if (json['subsonic-response'].status === 'failed') {
        const { code, message } = json['subsonic-response'].error
        throw new SubsonicError(code, message, false)
      }
      return json['subsonic-response']
    } catch (e) {
      if (!isRetryable(e) || attempt === 2) throw e
      await sleep(500 * (attempt + 1))
    }
  }
}
```

**エラー対処方針：**

| エラー種別 | 対処 |
|---|---|
| ネットワーク障害（一時的） | リトライ 3 回、フッターに警告表示 |
| 認証エラー（401） | ログイン画面に戻す |
| MPV 接続失敗 | 自動再起動を 1 回試みる |
| スクロブル失敗 | サイレント無視（再生は止めない） |
| カバーアート取得失敗 | プレースホルダー表示 |
| 設定ファイル破損 | デフォルト設定にフォールバック |

---

## テスト方針

`bun test` を使用。ロジック層のテストを優先し、UI スナップショットは主要コンポーネントのみ。

**優先テスト対象（バグが多かった箇所）：**

```typescript
// scrobble.test.ts
test('30秒未満の曲はスクロブルリクエストを送らない')
test('曲開始時に submission=false を即時送信する')
test('50% 地点で submission=true を送信する')
test('スキップ時はタイマーをキャンセルする')

// queue.test.ts
test('enqueueNext は現在曲の直後に挿入する')
test('clear 後は currentIndex が -1 になる')
```

---

## 統合機能

デスクトップ通知のみ実装する。Discord Rich Presence・MPRIS・macOS メディアコントロールは対象外。

---

## SubTUI からの主な改善点

| 項目 | SubTUI | 本実装 |
|---|---|---|
| 状態管理 | 107 フィールドの god object | Zustand 4 スライス |
| Now Playing スクロブル | 未動作（バグ） | 即時送信（修正） |
| 完了スクロブル | 未実装 | 50%/240s タイミングで実装 |
| アルバムアート画質 | Unicode ブロック（低画質） | Kitty protocol（高画質） |
| ページネーション | 150 件固定・UI なし | スクロール末尾で次の 150 件を自動取得（インクリメンタルロード） |
| エラーハンドリング | サイレント無視が多数 | 分類して適切に対処 |
| 画像キャッシュ | 無制限（メモリ圧迫） | LRU 20 枚上限 |
| ランタイム | Go | Bun（TypeScript ネイティブ） |
