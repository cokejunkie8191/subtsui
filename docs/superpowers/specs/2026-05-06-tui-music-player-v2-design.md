# SubTSUI v2 設計仕様（再設計）

**日付:** 2026-05-06
**ステータス:** 承認済み
**前バージョン:** `2026-05-05-tui-music-player-design.md`（凍結）
**ブランチ予定:** `feat/redesign-v2`（実装開始時に切る）

---

## 背景

v1（プラン `2026-05-05`）は機能を縦に積む形で実装されたが、結合後に以下の根本問題が露呈した：

- キー入力が単一の global handler に集中し、フォーカスやモードを表現できない
- カーソルがストア直書きで、複数スクリーン間で干渉する
- 仕様の半分以上が未配線（アルバム/アーティストへのドリルダウン、Queue 操作、loopMode 動作、Help、設定 UI 等）
- 40,000 曲規模での性能を考慮していない（仮想スクロールなし）

これらは個別バグではなく、設計レベルの問題に起因するため、v2 として設計から作り直す。

---

## ゴール

### スコープ（MVP）

- Subsonic ログイン（plaintext / hashed / api_key）
- Albums リスト表示（newest 順、ページング）
- Album 詳細（曲一覧）
- 曲の再生（MPV、gapless / replaygain）
- Queue（自動でアルバム曲が積まれる、表示・基本操作）
- Search（曲・アルバム・アーティストの全文検索）
- **Search → Artist → Albums → Album Detail → Play の動線**
- Last.fm Now Playing & completion スクロブル
- カバーアート（Kitty / iTerm2 / blocks フォールバック）
- TOML 設定読み込み（書き出し / 自動生成は後回し）
- デスクトップ通知

### 非スコープ（将来 A への拡張時に追加）

- All Songs / Artists タブ / Playlists / Starred ビュー
- アルバム → アーティスト ジャンプ
- スター / レーティング / プレイリスト追加
- 設定変更 UI（TOML 手編集で代用）
- Help オーバーレイ
- savePlayQueue（サーバー側キュー同期）

### 拡張容易性

A 状態への拡張を阻害する設計をしない。具体的には：
- 新スクリーンは `Screen` インターフェース実装 + ファクトリ関数の追加だけで足りる
- 新キーは Layer 1（global）または Layer 2（screen-local）に追加するだけで足りる
- 新ストアは独立して追加可能

---

## アーキテクチャ

### プロジェクト構造

```
src/
  main.tsx                          # エントリポイント
  app.tsx                           # ルート、サービス初期化、Layer 1 グローバルキー

  screens/                          # 各画面（Screen 実装）
    AlbumsScreen.tsx                # Library タブのルート
    AlbumDetailScreen.tsx           # アルバム内の曲一覧（Library/Search 共有）
    ArtistDetailScreen.tsx          # アーティストのアルバム一覧（Search から push）
    QueueScreen.tsx                 # キュータブのルート
    SearchScreen.tsx                # 検索タブのルート
    LoginScreen.tsx                 # ログイン
    NowPlayingScreen.tsx            # M キーで開く全画面モーダル

  components/                       # 純粋表示（ロジックなし）
    PlayerBar.tsx                   # フッター
    TabBar.tsx                      # ヘッダー
    AlbumArt.tsx
    ProgressBar.tsx
    SongRow.tsx
    AlbumRow.tsx
    StatusLine.tsx                  # エラー / status 表示行

  framework/                        # アプリ非依存のインフラ
    Screen.ts                       # Screen インターフェース定義
    KeyRouter.tsx                   # Layer 1/2/3 ルーター
    WindowList.tsx                  # ウィンドウレンダリング汎用
    safeLoad.ts                     # エラーハンドリングヘルパ

  stores/
    player.store.ts
    queue.store.ts
    nav.store.ts                    # タブ・スタック・モーダル状態
    library.store.ts                # アルバム一覧キャッシュ（曲は持たない）
    status.store.ts                 # StatusLine 用

  services/                         # 既存からほぼ流用
    subsonic.ts
    mpv.ts
    scrobble.ts
    image.ts
    notify.ts

  config/
    config.ts
    defaults.ts
    keybinds.ts

  types/
    subsonic.ts
    player.ts
    config.ts

tests/
  unit/
    keyrouter.test.ts               # 新規
    nav.store.test.ts               # 新規
    queue.test.ts                   # 既存 + jumpTo テスト追加
    scrobble.test.ts                # 既存
    config.test.ts                  # 既存
    keybinds.test.ts                # 既存
    image.test.ts                   # 既存
  integration/
    subsonic.test.ts                # 既存 + 拡張
    screen-stack.test.ts            # 新規
```

### Screen 抽象

```typescript
// framework/Screen.ts
export type KeyEvent = {
  input: string
  key: {
    return?: boolean; escape?: boolean; tab?: boolean; shift?: boolean; ctrl?: boolean
    upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean
  }
}

export type Screen = {
  id: string                              // 'albums' | 'album-detail:42' などユニーク
  title: string                           // タブヘッダーやパンくず用
  render: () => React.ReactNode
  onKey?: (e: KeyEvent) => boolean        // true = consumed (Layer 1 もスキップ)
  onMount?: () => void
  onUnmount?: () => void
  isModal?: boolean                       // true なら Layer 1 を遮断
}
```

### スタックモデル

```typescript
type Tab = 'library' | 'queue' | 'search'

type NavState = {
  activeTab: Tab
  stacks: Record<Tab, Screen[]>           // 各タブの履歴
  modal: Screen | null                    // NowPlaying など全画面モーダル
  textInputFocused: boolean               // Layer 3 ON フラグ（TextInput 側が立て下げ）

  setTab: (t: Tab) => void                // タブ切替（スタック保持）
  push: (s: Screen) => void               // 現タブのスタック末尾に追加
  pop: () => boolean                      // ルートで false を返す
  replace: (s: Screen) => void            // 末尾置き換え
  openModal: (s: Screen) => void
  closeModal: () => void
  setTextInputFocused: (v: boolean) => void
}
```

**初期化:**
- 初期は `stacks` が空、`activeTab='library'` で「Loading...」を表示
- `loadConfig` + `loadCredentials` 完了後、credentials がなければ `replace(LoginScreen)`
- `initServices()` 成功後、各タブのルートを `replace`：library に AlbumsScreen、queue に QueueScreen、search に SearchScreen

各 Screen ファクトリは必要なサービスを引数で受け取る形（例: `makeAlbumsScreen(subsonic)`）。

### キーボードルーティング（3層）

```
キー押下
  │
  ▼
[Layer 3] TextInput がフォーカス中？
  ├ Yes → TextInput が処理。Esc のみ KeyRouter にも伝播
  └ No  → 次へ
  │
  ▼
[Layer 2] activeScreen.onKey(e)
  ├ true → 終了
  └ false → 次へ
  │
  ▼
[Layer 1] グローバルマッピング
  ├ マッチ → 実行
  └ なし → 何もしない
  ※ activeScreen.isModal === true なら Layer 1 はスキップ
```

#### Layer 1（Always-on Global、MVP）

| キー | アクション |
|---|---|
| `Space` | 再生 / 一時停止 |
| `n` | 次の曲 |
| `p` | 前の曲 |
| `+` `=` | ボリューム +5 |
| `-` | ボリューム -5 |
| `<` | -10秒シーク |
| `>` | +10秒シーク |
| `.` | 曲の先頭へ |
| `l` | ループモード切替 (none → all → one) |
| `M` | NowPlaying モーダル開閉 |
| `Tab` `S-tab` | タブ切替 |
| `1` `2` `3` | タブ直接ジャンプ |
| `/` | Search タブにジャンプ + input モード |
| `Z Z` | 終了（300ms 以内のダブルタップ） |
| `Ctrl+C` | 強制終了 |

#### Layer 2（Screen-local、共通慣習）

| キー | 共通の意味 |
|---|---|
| `j` `↓` | カーソル下 |
| `k` `↑` | カーソル上 |
| `g` | リストの先頭 |
| `G` | リストの末尾 |
| `Enter` | 選択（drill-down または再生） |
| `Esc` `h` | 1段戻る (`nav.pop()`) |

#### Layer 2（スクリーン固有キー）

| Screen | キー | 動作 |
|---|---|---|
| AlbumsScreen | `Enter` | アルバム詳細を push |
| AlbumDetailScreen | `Enter` | 曲を再生 + アルバムの残り曲をキュー |
| AlbumDetailScreen | `q` | 1曲をキュー末尾 |
| AlbumDetailScreen | `Q` | アルバム全体をキュー末尾 |
| ArtistDetailScreen | `Enter` | アルバム詳細を push |
| QueueScreen | `Enter` | その曲にジャンプして再生 |
| QueueScreen | `x` | 1行削除 |
| QueueScreen | `X` | 全クリア |
| SearchScreen (results) | `Tab` | filter 切替（Layer 2 で consume、Layer 1 のタブ切替を抑止） |

#### Layer 3 (TextInput Modal)

`SearchScreen` が input モード中：
- TextInput が全キーを受け取る
- 例外: `Esc` だけ KeyRouter にも届ける
- `Enter` は TextInput の `onSubmit` で検索確定 + results モードへ遷移

### ストアとローカル state の境界

| ストア | 役割 |
|---|---|
| `player.store` | 再生状態 (status/song/position/volume/loopMode/error) |
| `queue.store` | キュー、現在曲インデックス、next/prev（末尾は null、ラップは呼び出し側） |
| `nav.store` | タブ・各タブの履歴スタック・モーダル状態・textInputFocused |
| `library.store` | Albums キャッシュ（newest 順、ページング状態） |
| `status.store` | StatusLine の最新メッセージ・自動消去タイマー |

**ローカル state（store に置かない）:**

| state | 場所 | 理由 |
|---|---|---|
| カーソル位置 | 各 Screen の `useState` | スクリーン固有 |
| ロード中フラグ | 各 Screen の `useState` | スクリーン固有 |
| 取得済みデータ（曲一覧など） | 各 Screen の `useState` | キャッシュは store の役目 |
| Search のクエリ・filter・mode | `SearchScreen` の `useState` | タブ離脱で破棄可 |

### ストア独立性原則

1. **store を相互参照しない** — `player.store` が `queue.store` を呼ぶ結合を作らない。連動は呼び出し側（app.tsx の playback handler / Screen）が行う。
2. **store の mutator は同期** — async は呼び出し側の責務。
3. **Screen は store に書き込んでよい、購読は read-only** — 直接編集はキーハンドラから。
4. **キャッシュは library.store に集約** — 高コストな再フェッチが必要なものだけ。

---

## 主要シナリオ end-to-end フロー

### A: 起動 → アルバム表示

```
main.tsx render(<App/>)
  ↓
App useEffect: loadConfig() → setConfig(cfg)
  ↓
App useEffect: loadCredentials()
  ├ なし → nav.replace(LoginScreen)
  └ あり → initServices(creds, cfg)
       ├ subsonic.ping() で疎通確認 (失敗時 → LoginScreen + error)
       ├ mpv.spawn({volume, gapless, replaygain})
       ├ scrobble = new ScrobbleService(subsonic.scrobble)
       ├ mpv.on('end-file', handleSongEnd)
       └ nav.replace(AlbumsScreen)
  ↓
AlbumsScreen onMount: library.loadMoreAlbums(subsonic) → 50件描画
```

### B: アルバムから再生

```
AlbumsScreen で 'Joshua Tree' を Enter
  → nav.push(makeAlbumDetailScreen('al-42'))

AlbumDetailScreen onMount
  → subsonic.getAlbum('al-42') → setSongs(...) (ローカル state)

3曲目を Enter
  → AlbumDetailScreen.onKey:
     queue.clear()
     queue.enqueueLast(songs)
     queue.jumpTo(2)
     player.setCurrentSong(songs[2])
     mpv.loadFile(streamUrl)
     scrobble.onSongStart(songs[2])
     notify(songs[2]) if enabled
```

### C: 曲送り（Layer 1 グローバル `n`）

```
n 押下
  → KeyRouter:
     Layer 3: TextInput なし
     Layer 2: activeScreen.onKey(n) → false
     Layer 1: handleGlobalKey({input:'n'}) → playbackController.next()
  → playbackController.next():
     scrobble.onSongSkip()
     s = queue.next()
     if (!s) return
     player.setCurrentSong(s)
     mpv.loadFile(streamUrl(s))
     scrobble.onSongStart(s)
```

### D: Search → Artist → Album → 再生

```
Tab → Search タブ
  ↓ nav.setTab('search')
SearchScreen onMount → ui.textInputFocused = true (Layer 3 ON)

'U2' 入力 + Enter
  ↓ TextInput onSubmit → SearchScreen.handleSearch()
     subsonic.search('U2') → setResults(...)
     ui.textInputFocused = false
     setMode('results')

Tab で filter を artists へ
  ↓ Layer 2 が先に consume (return true) → Layer 1 のタブ切替を抑止

U2 を Enter
  ↓ nav.push(makeArtistDetailScreen('ar-9'))

Joshua Tree を Enter
  ↓ nav.push(makeAlbumDetailScreen('al-42'))

Esc を 3回押す
  ↓ Layer 2 (各 onKey で nav.pop())
  ArtistDetail → SearchScreen → (ルート、何もせず)
```

### E: 曲が終わった (mpv end-file)

```
mpv → emit('end-file', reason)
  reason !== 'eof' なら無視

handleSongEnd（app.tsx に閉じる、queue.store は loopMode を知らない）:
  const lm = player.loopMode
  ├ lm === 'one' →
  │     mpv.loadFile(streamUrl(currentSong))
  │     scrobble.onSongStart(currentSong)
  │
  ├ lm === 'all' →
  │     s = queue.next()
  │     if (!s) {
  │       queue.jumpTo(0)            # 末尾→先頭ラップ
  │       s = queue.items[0] ?? null
  │     }
  │     if s: 再生
  │
  └ lm === 'none' →
        s = queue.next()
        if s: 再生
        else: player.setStatus('stopped')
```

---

## エラーハンドリング

### 原則

1. **再生は止めない** — スクロブル/通知/カバーアート失敗で曲は止まらない
2. **エラーは StatusLine に集約** — フッター 1 行、自動消去
3. **クラッシュさせない** — Screen 内 async は必ず try/catch
4. **回復可能なら自動回復** — MPV 切断・トランジェントネットワーク
5. **回復不能ならユーザーに選択肢** — 認証エラーは LoginScreen に戻す

### 種別と対応

| 種別 | 検知 | 対応 |
|---|---|---|
| ネットワーク一時障害 | `subsonic.request` の retry 層 | 3回リトライ (500/1000/1500ms backoff)、失敗で StatusLine |
| 認証エラー (401, code 40/41) | レスポンス検査 | nav.replace(LoginScreen)、credentials 残す |
| Subsonic API エラー (code 10, 70 等) | レスポンス body | StatusLine、現操作中止 |
| MPV 起動失敗 | `mpv.spawn()` 例外 | 1回再試行 → 失敗で fatal モーダル |
| MPV 切断 (実行中) | `useMpvSync` 連続失敗 | 5回連続失敗で respawn 試行 → 失敗で StatusLine |
| MPV コマンド失敗 | `mpv.send` reject | StatusLine、再生継続 |
| スクロブル失敗 | `subsonic.scrobble` catch | 完全無視 |
| カバーアート失敗 | `image.fetchAndRender` catch | プレースホルダー (🎵) |
| 通知失敗 | `notify.send` catch | 完全無視 |
| 設定ファイル破損 | TOML パース失敗 | デフォルトにフォールバック + StatusLine 警告 |

### StatusLine

```typescript
// stores/status.store.ts
type StatusState = {
  message: string | null
  level: 'info' | 'warn' | 'error' | null
  setStatus: (msg: string, level: 'info'|'warn'|'error', autoHideMs?: number) => void
  clear: () => void
}
```

自動消去: info=3秒, warn=5秒, error=8秒

### MPV 切断回復

```
useMpvSync 5回連続失敗 (2.5秒)
  → status.setStatus('MPV connection lost, restarting...', 'warn')
  → mpv.respawn({volume, gapless, replaygain, lastFile, lastPos})
       ├ 成功 → status.setStatus('MPV reconnected', 'info', 2000)
       └ 失敗 → status.setStatus('MPV unavailable', 'error')
                player.status = 'stopped'
```

`MpvClient.respawn` は内部で前回の loadFile + seek 位置を保持し、起動後に復元する。

### 共通エラーパターン

```typescript
// framework/safeLoad.ts
async function safeLoad<T>(fn: () => Promise<T>, errorMsg: string): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    useStatusStore.getState().setStatus(
      e instanceof Error ? `${errorMsg}: ${e.message}` : errorMsg,
      'error'
    )
    return null
  }
}
```

各 Screen で繰り返し使う。

---

## UI レイアウト

### 全体構造

```
┌──────────────────────────────────────────────────────────────────┐
│ [Library]  Queue  Search                                          │  TabBar (1行)
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│           Active Screen の render() がここに入る                   │  Content (flexGrow=1)
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│ 🖼 ▶ Title — Artist                                               │
│      ████████░░░░░░░░░░  1:23/4:05  🔁 🔊80                       │  PlayerBar (2行)
├──────────────────────────────────────────────────────────────────┤
│ ⚠ Status message                                                  │  StatusLine (条件付き)
└──────────────────────────────────────────────────────────────────┘
```

### TabBar

```
[Library]  Queue  Search
```

- 現在タブを `[...]` で囲む + bold + highlight color
- 区切りは半角スペース 2

### AlbumsScreen

```
Albums (newest)                                          1234 / 3245

  Joshua Tree                  U2                    1987
  Achtung Baby                 U2                    1991
▶ Loveless                     My Bloody Valentine   1991
  Pet Sounds                   The Beach Boys        1966
  ...
```

### AlbumDetailScreen

```
Loveless  ─  My Bloody Valentine  ─  1991                Esc/h: back

  1.  Only Shallow                                       4:17
  2.  Loomer                                             2:38
▶ 3.  Touched                                            0:56
  4.  To Here Knows When                                 5:31
  ...

  Total: 11 tracks  ·  48:25
```

### QueueScreen

```
Queue (5 tracks)                              x: remove · X: clear

  1.  Only Shallow             - My Bloody Valentine
  2.  Loomer                   - My Bloody Valentine
▶ 3.  Touched                  - My Bloody Valentine     [now playing]
  4.  To Here Knows When       - My Bloody Valentine
  5.  When You Sleep           - My Bloody Valentine
```

### SearchScreen (input mode)

```
/ U2_

(start typing to search)
```

### SearchScreen (results mode)

```
/ U2                                          Esc/: input back

  Songs (8)   Albums (12)   Artists (1)         ← Tab で切替

▶ Where the Streets Have No Name  - U2 - Joshua Tree
  With or Without You             - U2 - Joshua Tree
```

### NowPlayingScreen (Modal)

```
┌────────────────────────────────────────────────────────────────┐
│   ┌──────────────────┐    Touched                                │
│   │   [album art]    │    My Bloody Valentine                    │
│   │                  │    Loveless (1991)                        │
│   └──────────────────┘    ████████░░░░░░░  0:56/2:38             │
│                           ★★★★☆                                 │
│                                                                  │
│   (歌詞があれば現在行ハイライト)                                  │
│                                          M / Esc to close       │
└────────────────────────────────────────────────────────────────┘
```

### PlayerBar

- 1行目: サムネ + 状態アイコン + 曲名 — アーティスト
- 2行目: 進捗バー(固定30文字) + 時刻 + ループ + ボリューム
- 再生なし時: `🎵 No track playing`

### StatusLine

- 該当時のみ表示
- アイコン: info=`ℹ`, warn=`⚠`, error=`✖`
- 色: subtle / yellow / red

### 配色

```typescript
{
  highlight: '#7dd3fc',  // 現在再生・選択
  subtle:    '#6b7280',  // 通常テキスト・補助
  special:   '#f472b6',  // スター（A 拡張時）
}
```

---

## テスト戦略

### 原則

- ロジック層を厚く、UI 層は薄く
- Bun test、`tests/unit/` と `tests/integration/`
- TDD は新規 framework/ にだけ厳守
- 手動 QA チェックリストを実装プランに組み込む

### 単体テスト

```
tests/unit/keyrouter.test.ts            ★最重要
  - Layer 3 active 時、Esc 以外の input は activeScreen.onKey に届かない
  - Layer 2 が return true → Layer 1 は呼ばれない
  - modal.isModal === true → Layer 1 がスキップ
  - 通常時: Layer 3 → 2 → 1 の順で評価

tests/unit/nav.store.test.ts            ★最重要
  - push() で stacks[activeTab] 末尾追加
  - pop() がルートで false
  - replace() が末尾置き換え
  - setTab() でスタック維持
  - openModal/closeModal が独立

tests/unit/queue.test.ts (既存ベース + 拡張)
  - enqueueLast, enqueueNext, remove, clear, jumpTo
  - next() が currentIndex を進める
  - next() が末尾で null を返す（ラップ処理は呼び出し側の責務）
  - prev() が先頭で null を返す

tests/unit/scrobble.test.ts (既存)
tests/unit/config.test.ts (既存)
tests/unit/keybinds.test.ts (既存)
tests/unit/image.test.ts (既存)
```

### 統合テスト

```
tests/integration/subsonic.test.ts (既存 + 拡張)
  - error code 40 で SubsonicError(retryable=false)
  - error code 50 で再試行

tests/integration/screen-stack.test.ts  ★新規
  - AlbumsScreen で Enter → AlbumDetail が push
  - AlbumDetail で Esc → 戻る
  - Search → Artist → Album の3階層 push/pop
  - タブ切替してもスタック保持
```

### テストしない

- ink コンポーネントの DOM スナップショット（メンテコスト高）
- MPV プロセス実起動（環境依存、CI 不安定）
- 画像レンダリング結果（視覚確認の方が早い）
- カバーアート fetch+resize（jimp 依存、smoke で確認）

### 手動 QA チェックリスト

実装プラン側で各 PR/タスク完了時に消化する：

```markdown
### 起動
- [ ] credentials なし → LoginScreen 表示
- [ ] 不正 credentials → LoginScreen + エラー
- [ ] 正常起動 → AlbumsScreen にアルバム表示

### 再生
- [ ] AlbumDetail で Enter → 再生 + キュー充填
- [ ] PlayerBar に曲名・進捗表示
- [ ] Space で一時停止/再生
- [ ] n/p で次曲/前曲
- [ ] +/- でボリューム
- [ ] 曲が終わると自動次曲
- [ ] M で NowPlaying モーダル開閉

### 検索
- [ ] /U2 入力 → 結果
- [ ] Tab で filter 切替
- [ ] Artist 選択 → ArtistDetail
- [ ] Album 選択 → AlbumDetail
- [ ] Esc で順次戻る

### スクロブル
- [ ] 曲開始直後に Last.fm Now Playing 更新
- [ ] 完了時刻に Last.fm scrobble

### エラー
- [ ] サーバー停止で StatusLine 警告
- [ ] サーバー再起動で復帰

### 終了
- [ ] Z Z で正常終了（mpv プロセス消失）
- [ ] Ctrl+C で強制終了
```

---

## 移行計画

### 既存コードの扱い

**流用（小修正）:**
- `services/subsonic.ts` — `isRetryable` の error code 分類追加
- `services/mpv.ts` — `respawn()` メソッド + 履歴保持追加
- `services/scrobble.ts` — そのまま
- `services/image.ts` — LRU 上限 50 に拡大
- `services/notify.ts` — そのまま
- `config/*` — defaults のキーバインドを Layer 1/2 分離形式に書き換え
- `types/*` — そのまま
- `stores/player.store.ts` — そのまま
- `stores/queue.store.ts` — `jumpTo(i)` 追加。`next()` は loopMode を関知せず末尾で null を返す（loopMode 判定は呼び出し側）

**新規:**
- `framework/Screen.ts`, `framework/KeyRouter.tsx`, `framework/WindowList.tsx`, `framework/safeLoad.ts`
- `stores/nav.store.ts`, `stores/status.store.ts`
- `stores/library.store.ts`（縮小再設計）
- `screens/*.tsx`（全部新規）
- `components/*.tsx`（全部新規）

**削除:**
- 既存 `app.tsx`（全面書き直し）
- `hooks/useKeyHandler.ts`, `hooks/useMpvSync.ts`
- 既存 `components/screens/*`, `components/shared/*`, `components/layout/*`

### ブランチ戦略

- 現在 `feat/tui-player` は v1 試作として残す
- 新ブランチ `feat/redesign-v2` を切って作業
- 完了時に v1 ブランチを破棄、v2 を main にマージ

### 実装順序

```
Phase 1: 基盤
  1. ステアリング docs を書く
  2. 既存コードの掃除（不要ファイル削除）
  3. framework/ 実装 + テスト

Phase 2: ストア再構成
  4. nav.store, status.store, library.store
  5. queue.store に jumpTo 追加

Phase 3: 画面実装
  6. AlbumsScreen + AlbumRow + WindowList 統合
  7. AlbumDetailScreen + SongRow
  8. QueueScreen
  9. SearchScreen (input/results モード)
  10. ArtistDetailScreen
  11. NowPlayingScreen (modal)
  12. LoginScreen
  13. PlayerBar / TabBar / StatusLine

Phase 4: 配線
  14. app.tsx でサービス init + KeyRouter 設置
  15. Layer 1 グローバルハンドラ (playbackController)
  16. mpv end-file 配線 + loopMode 動作

Phase 5: QA
  17. 手動 QA チェックリスト消化
  18. 残バグ修正
```

詳細は `plans/2026-05-06-tui-music-player-v2.md` のチェックボックスで管理する。
