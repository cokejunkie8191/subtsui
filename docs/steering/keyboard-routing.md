# Keyboard Routing（キー入力ルーティング規約）

このドキュメントは SubTSUI のキー入力ルーティングルールである。新キー追加・キー衝突解決の際はこれに従う。

## 3層モデル

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
  ├ true (consumed) → 終了
  └ false           → 次へ
  │
  ▼
[Layer 1] グローバルマッピング
  ├ マッチ → 実行
  └ なし   → 何もしない
  ※ activeScreen.isModal === true なら Layer 1 はスキップ
```

## Layer 1（Always-on Global）

「アプリ全体で常に同じ意味を持つ」キーだけを置く。

| キー | アクション | カテゴリ |
|---|---|---|
| `Space` | 再生 / 一時停止 | playback |
| `n` | 次の曲 | playback |
| `p` | 前の曲 | playback |
| `+` `=` | ボリューム +5 | playback |
| `-` | ボリューム -5 | playback |
| `<` | -10 秒シーク | playback |
| `>` | +10 秒シーク | playback |
| `.` | 曲の先頭へ | playback |
| `l` | ループモード切替 | playback |
| `M` | NowPlaying モーダル開閉 | overlay |
| `Tab` `S-tab` | タブ切替 | navigation |
| `1` `2` `3` | タブ直接ジャンプ | navigation |
| `/` | Search タブ + input モード | navigation |
| `Z Z` | 終了（300ms 以内のダブルタップ） | global |
| `Ctrl+C` | 強制終了 | global |

### Layer 1 にキーを追加する条件

- 任意の Screen にいる時にも同じ意味で動作させたい
- 一文字で表現できる
- 既存 Layer 1 / Layer 2 共通慣習と衝突しない

衝突する場合は Layer 2 で扱う（既存スクリーンに onKey を追加）。

## Layer 2（Screen-local）

各 Screen が `onKey: (e: KeyEvent) => boolean` で実装する。
**戻り値 `true` で consume**（Layer 1 に渡さない）、`false` で渡す。

### 共通慣習（全 Screen で同じ意味）

| キー | 共通の意味 |
|---|---|
| `j` `↓` | カーソル下 |
| `k` `↑` | カーソル上 |
| `g` | リストの先頭 |
| `G` | リストの末尾 |
| `Enter` | 選択（drill-down または再生） |
| `Esc` `h` | 1段戻る (`nav.pop()`) |

これらのキーは新 Screen でも同じ意味で使う。違う意味で使いたい場合は別キーを選ぶ。

### スクリーン固有キー

スクリーンに固有の動作はそのスクリーンの onKey で定義する。
**Layer 1 のキーと衝突する場合**は、Layer 2 で先に consume する（return true）。

例: SearchScreen の results モードで Tab を filter 切替に使う場合：

```typescript
onKey: (e) => {
  if (e.key.tab) {
    cycleFilter()
    return true  // Layer 1 のタブ切替を抑止
  }
  return false
}
```

## Layer 3（Text Input Modal）

TextInput がフォーカスを持つ時、すべての通常キー入力を独占する。

### ルール

- TextInput の `focus` prop を `true` にすると Layer 3 ON
- ON の間、Layer 1 / Layer 2 は **`Esc` を除いて** 動作しない
- `Esc` だけ Layer 2 にも伝播 → Screen が「フォーカス解除して別モードへ」などのハンドリング可能
- Enter は TextInput の `onSubmit` を直接ハンドル（Layer 2/1 には流さない）

### 実装上の注意

- フォーカス状態は `nav.store.textInputFocused: boolean` で共有
- TextInput を表示する Screen が mount/unmount 時に `setTextInputFocused(true/false)` を呼ぶ
- KeyRouter は `textInputFocused === true` の時、`Esc` 以外を素通り

## キー衝突の解決ルール

衝突したら以下の順で判断する：

1. **TextInput がフォーカス中なら** Layer 3 が勝つ（自動）
2. **Screen 固有の意味があるなら** Layer 2 で consume（return true）
3. **どこでも同じ意味なら** Layer 1 に置く

### よくある衝突例

| キー | 衝突 | 解決 |
|---|---|---|
| `Tab` | Layer 1 のタブ切替 vs Search results の filter 切替 | Layer 2 で先に consume |
| `Enter` | Layer 2 の再生 / drill-down | Layer 1 にはそもそも `Enter` を置かない |
| `n` | Layer 1 の次曲 vs テキスト入力の文字 | Layer 3 で TextInput が独占 |
| `q` | Layer 1（過去仕様の終了）vs Layer 2 のキュー追加 | 終了は `Z Z` に変更、`q` は Layer 2 専用 |

## キーバインドの設定可能性

`config.toml` の `[keybinds]` セクションで上書き可能。
ただし設定対象は **Layer 1 と Layer 2 共通慣習** のみ。スクリーン固有キーは設定できない（仕様の一貫性維持のため）。

```toml
[keybinds.global]
play_pause = ["space"]
next       = ["n"]

[keybinds.navigation]
up   = ["k", "up"]
down = ["j", "down"]
```

## デバッグ tips

「キーを押しても何も起きない」時のチェック順：

1. `nav.store.textInputFocused === true` ではないか？ → Layer 3 で吸われている
2. `activeScreen.onKey` が `true` を返していないか？ → Layer 1 に届いていない
3. Layer 1 のマッピングに該当アクションがあるか？ → `defaults.ts` を確認
4. `activeScreen.isModal === true` ではないか？ → Layer 1 がスキップされる
