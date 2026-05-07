# Architecture（アーキテクチャ原則）

このドキュメントは SubTSUI のアーキテクチャの「変えたら影響が大きい」原則を集めたものである。新機能・新画面・リファクタリングの際は、これに反する変更を避けること。

## 全体構造

### レイヤー

```
[Services]    Subsonic API / MPV IPC / Scrobble / Image / Notify
   ↑           副作用を持つ。app.tsx で初期化、Screen から呼び出される
   │
[Stores]      player / queue / nav / library / status
   ↑           Zustand。グローバル状態のみ。ローカル state は Screen 側
   │
[Framework]   Screen / KeyRouter / WindowList / safeLoad
   ↑           アプリ非依存のインフラ。テスト可能で独立
   │
[Screens]     AlbumsScreen / AlbumDetailScreen / QueueScreen / etc.
   ↑           Screen インターフェース実装。タブ・スタックに乗る
   │
[Components]  PlayerBar / TabBar / SongRow / etc.
               純粋表示。ロジックなし、props だけで決まる
```

### 依存方向

```
app.tsx → screens → components
              ↓        ↓
            stores ← framework
              ↓
            services
```

**禁止事項:**
- store が他の store を参照する
- component が store を直接参照する（props で渡す）
- service が React/Ink を import する

## 画面構成: タブ + 履歴スタック

### 不変条件

- 画面はすべて `Screen` インターフェースを実装する
- 画面遷移は `nav.push` / `nav.pop` / `nav.replace` のみ
- 同じ画面を別パラメータで複数 push 可能（id にコロンでパラメータを含める：`album-detail:42`）
- モーダルは `nav.openModal` / `nav.closeModal`、スタックとは独立

### 新画面追加の手順

1. `screens/<NewScreen>.tsx` を作成（`Screen` を返すファクトリ関数 + 描画コンポーネント）
2. push したい場所で `nav.push(makeNewScreen(args))` を呼ぶ
3. それだけ。app.tsx の if-else を書き換える必要なし

## カーソル・ローカル state は Screen が持つ

`store` には **複数 Screen 間で共有すべき状態だけ** を置く。
カーソル位置・ロード中フラグ・取得済みデータは各 Screen の `useState`。

### 理由

- Library と Search が同時に AlbumDetail を push しているとき、それぞれ独立したカーソル位置を持つ必要がある
- store にカーソルを置くと、画面遷移時にリセットや保存のロジックが複雑化する

## ストア独立性

- store は他の store を import しない
- store の mutator は同期。async 処理は呼び出し側が担う
- store のキャッシュは「再フェッチが高コスト」のものだけ

## 性能方針

### 長いリスト

3,000+ 要素のリストは必ず `WindowList` でウィンドウレンダリングする。Ink は全要素 render すると重い。

### ページング

API は 150 件単位で取得。リスト末尾近く（残り < 30 件）になったら追加 fetch をトリガー。

### キャッシュ

- 画像: LRU 50 件まで
- アルバムメタデータ: `library.store` に蓄積（明示的に `invalidate()` するまで保持）
- 曲の詳細: 各 Screen が必要時にその場で fetch（キャッシュしない）

## エラー処理の原則

詳細は `error-handling` を仕様書側に記載。ここでは原則のみ：

1. 再生は止めない
2. エラーは `status.store` に集約 → StatusLine に表示
3. クラッシュさせない（async は必ず try/catch、`safeLoad` ヘルパを使う）
4. 認証エラーは LoginScreen に戻す
5. MPV 切断は自動 respawn を試みる

## 拡張時の指針

### MVP → A への拡張で予想される追加

- All Songs / Artists タブビュー
- Playlists / Starred ビュー
- スター / レーティング / プレイリスト追加アクション
- 設定変更 UI
- Help オーバーレイ

### 拡張時に守ること

- 新 Screen は `Screen` インターフェースを実装、既存スクリーンのコードに触らない
- 新キーは Layer 1（既存の global）か Layer 2（新 Screen の onKey）に追加
- 新ストアが必要なら独立して追加。既存 store を肥大化させない
- 新サービスは `services/` に追加、依存方向を守る

### 拡張時に「やらない」こと

- 既存 Screen のコードに大きく手を入れる（コピペで新 Screen を作る方がよい）
- store 同士の参照を許可する
- 「とりあえず global に追加」してキー衝突を生む（Layer 2 で済むなら 2 を選ぶ）
