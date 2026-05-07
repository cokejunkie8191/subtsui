# State Management（状態管理の境界）

このドキュメントは SubTSUI の状態をどこに置くかのルールである。新ストア追加・既存ストア変更の際はこれに従う。

## 大原則

```
グローバルに共有する状態だけを store に置く。
それ以外は Screen ローカルの useState に置く。
```

## ストア一覧

| ストア | 役割 | 共有理由 |
|---|---|---|
| `player.store` | 再生状態 (status/song/position/volume/loopMode/error) | PlayerBar・NowPlayingScreen・複数 Screen が購読 |
| `queue.store` | キュー、現在曲インデックス | QueueScreen・PlayerBar・playbackController が触る |
| `nav.store` | タブ・各タブの履歴スタック・モーダル | KeyRouter・Layer 1・各画面遷移 |
| `library.store` | Albums キャッシュ（newest 順、ページング状態） | AlbumsScreen が購読、再フェッチ高コスト |
| `status.store` | StatusLine の最新メッセージ | あらゆる場所からエラー報告 |

## ローカル state（store に置かない）

| state | 場所 | 理由 |
|---|---|---|
| カーソル位置 | 各 Screen の `useState` | スクリーン固有、複数同時 push されることがある |
| ロード中フラグ | 各 Screen の `useState` | スクリーン固有 |
| 取得済みデータ（曲一覧など） | 各 Screen の `useState` | キャッシュは store の役目、表示中スクリーンが取ってくる |
| Search のクエリ・filter・mode | `SearchScreen` の `useState` | Search タブを離れたら破棄でよい |
| 検索結果 | `SearchScreen` の `useState` | 同上 |

## 不変条件

### 1. ストアは互いを参照しない

```typescript
// ❌ NG: store が他の store を呼ぶ
const usePlayerStore = create((set, get) => ({
  next: () => {
    const queue = useQueueStore.getState()  // ← 結合
    const song = queue.next()
    ...
  }
}))

// ✅ OK: 呼び出し側で連動
function handleNext() {
  const song = useQueueStore.getState().next()
  if (song) usePlayerStore.getState().setCurrentSong(song)
}
```

ストア間連動が必要なロジックは `app.tsx` の playback handler や Screen の onKey で書く。

### 2. mutator は同期

```typescript
// ❌ NG: store の mutator が async
const useLibraryStore = create((set) => ({
  loadMoreAlbums: async (subsonic) => {
    set({ isLoading: true })
    const albums = await subsonic.getAlbumList(...)
    set({ albums, isLoading: false })
  }
}))
```

**理由:** async mutator はテストしにくく、エラー処理がストアに混ざる。

```typescript
// ✅ OK: mutator は同期だけ。async は Screen 側
const useLibraryStore = create((set) => ({
  setAlbums: (albums) => set({ albums }),
  appendAlbums: (more) => set(s => ({ albums: [...s.albums, ...more] })),
  setLoading: (v) => set({ isLoading: v }),
}))

// Screen 側
async function loadMore() {
  setLoading(true)
  try {
    const more = await subsonic.getAlbumList(...)
    appendAlbums(more)
  } catch (e) { /* status.store に書く */ }
  finally { setLoading(false) }
}
```

例外: store に閉じた純粋なデータ操作（`enqueueLast` などの配列操作）は同期なので OK。

### 3. Screen は store に書き込んでよい、購読は read-only

- 書き込み: `useStore.getState().mutator(args)` をキーハンドラから呼ぶ
- 購読: `const x = useStore(s => s.x)` で read-only に取得
- 「購読しながら書き込む」のは selector 経由なら OK

### 4. キャッシュは「再フェッチが高コスト」のものだけ

- ✅ Albums メタデータ（数千件、ページング込み）
- ✅ アーティスト一覧（getArtists 一括取得）
- ❌ アルバムの曲一覧（数十件、すぐ取れる、メモリ圧迫）
- ❌ 検索結果（クエリごとに変わる、Screen ローカルで十分）

## 新ストア追加の判断基準

新しい状態を store にすべきか迷ったら：

1. **複数の Screen / コンポーネントが購読するか？**
   - No → ローカル state
   - Yes → 次へ

2. **画面遷移をまたいで保持したいか？**
   - No → ローカル state（または親 Screen の state）
   - Yes → 次へ

3. **既存ストアの責務に近いか？**
   - 近い → 既存ストアに追加
   - 遠い → 新ストア作成

迷ったら最小スコープから始める（ローカル state → 親 component の state → store）。

## ストアの粒度

- 1 ストア = 1 つの関心事
- フィールドが 5-10 個を超えたら分割を検討
- 例: `player.store` に Queue 操作を入れない（独立した関心事）

## Zustand 流儀

- `create<State>((set, get) => ({ ... }))` のパターンを統一
- selector を使う: `const x = useStore(s => s.x)` で必要な部分だけ subscribe
- `getState()` はキーハンドラなど React 外からのアクセスにのみ使う（component の中では使わない）

## デバッグ tips

「state が反映されない」時のチェック：

1. selector 関数を毎回新しい関数で渡していないか（参照が変わると毎回 re-render）
2. mutator を呼んでいるが set されていないか（typo / 古い state を返している）
3. store が複数インスタンスになっていないか（import パスのケース違い）
