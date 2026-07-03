# mimimilli Web再設計 提案

> **このドキュメントは `docs/architecture-v2-proposal.md`（2026-06-11）に置き換えられた。** Rust(axum) サーバー継続を前提とした本提案は設計経緯の記録として残す。
> **ステータス（2026年5月時点）:** axum サーバー化（旧 Phase 1）は完了済み。フロントエンドは mimimilli デザイン（`docs/design_handoff_mimimilli_library/`）をベースに全面再構築中（旧フロントコンポーネントは廃棄予定）。バックエンドも新スコープ（軸ファセット集計・タグAND検索・スマートフォルダー）に合わせて全面再構築。詳細は `docs/requirements-v4.md` を参照。
> 文書の提案内容は設計経緯の記録として維持する。

## 1. 結論

mimimilli を今後の本線として作り直すなら、**「ブラウザUI + ローカル常駐APIサーバー」構成**を推奨する。

- フロントエンドは **Webアプリ** として開発する
- ローカルファイル走査、メタファイル更新、SQLite、音声配信、将来のリモート配信は **ローカルHTTPサーバー** に集約する
- ネイティブアプリ化は後回しにし、必要になったら Web UI を薄くラップする

この方針なら、Tauri 依存によるデバッグ性の悪さを解消しつつ、mimimilli の本質である「ローカルファイル管理」と「ストリーミング」を捨てずに済む。

## 2. 前提整理

現状要件から見て、mimimilli のコアは以下。

- ローカルの作品フォルダを走査する
- `.meta.json` を Source of Truth として扱う
- SQLite を検索用キャッシュとして使う
- 音声ファイルや画像を快適に閲覧・再生する
- 将来的には外出先などからのストリーミングも視野に入れる

このため、単なる SaaS 的な Web アプリではなく、**ローカルファイルシステムと強く連動するアプリ**として考える必要がある。

## 3. なぜブラウザ単体ではなくローカルサーバー併用か

### 3.1 ブラウザ単体案の利点

- UI デバッグが圧倒的に楽
- React/Vite の通常開発フローに乗せやすい
- ネイティブラッパーなしでまず動く

### 3.2 ただしブラウザ単体案の制約が重い

- 任意のローカルフォルダを常時監視しづらい
- 永続的なファイル書き換えやバックグラウンド処理が弱い
- Chromium 系の File System Access API に強く依存する
- Safari/Firefox 互換性が弱い
- 音声ファイル配信や Range 対応、認可付きストリーミングを組みにくい
- 将来の「別端末からアクセス」にそのまま伸ばしにくい

つまり、**ブラウザでUIを動かすこと**と、**ブラウザだけで全責務を持つこと**は分けたほうがいい。

## 4. 推奨アーキテクチャ

## 4.1 構成

```text
Browser UI (React)
  ↓ HTTP / SSE / WebSocket
Local API Server
  ├─ Library Service
  ├─ Scanner
  ├─ Metadata Writer
  ├─ Audio / Image Streaming
  ├─ DLsite Integration
  └─ SQLite
       ↑
  Local Files (.meta.json / audio / image)
```

## 4.2 各レイヤーの責務

### Webフロントエンド

- ライブラリ一覧、検索、タグ編集、プレイヤーUI
- API 呼び出し
- Audio 要素による再生
- 再生状態の表示

### APIサーバー

- ルートフォルダ設定
- スキャン実行
- `.meta.json` の読み書き
- DB 同期
- カバー画像や音声の HTTP 配信
- Range リクエスト対応
- SSE または WebSocket によるスキャン進捗通知
- 将来の認証付きリモートアクセス

### ファイルシステム

- 音声本体
- 画像
- `.meta.json`

### DB

- 検索・一覧用キャッシュ
- レジューム位置
- ブックマーク
- 最終再生日時
- 検索プリセット

## 5. サーバー実装言語の比較

## 5.1 Rust

### 向いている点

- 既存の `scanner.rs`, `db.rs`, `service.rs`, `dlsite.rs` をかなり流用できる
- ファイルI/O、ストリーミング、並列処理、堅牢性に強い
- 将来の大きめライブラリや長時間常駐にも耐えやすい
- 既にサービス層分離の方針があるので HTTP 化しやすい

### 弱い点

- 開発速度は TypeScript より遅くなりやすい
- UI寄りの小回りは利きにくい
- サーバーを触るたびにビルドコストがある

### 評価

**現状資産を活かすなら最有力。**

## 5.2 Go

### 向いている点

- HTTP サーバーやストリーミングは書きやすい
- 単一バイナリ配布しやすい
- ビルド速度が速い

### 弱い点

- 既存 Rust 資産をほぼ移植する必要がある
- メタファイル処理や DB 周りを再実装するコストがある
- 型モデルやドメインロジックの流用メリットが薄い

### 評価

**新規で割り切るなら有力だが、今の段階では乗り換えコストが大きい。**

## 5.3 TypeScript/Bun

### 向いている点

- フロントと同じ言語で統一できる
- 試作速度が速い
- API と UI の型共有をしやすい

### 弱い点

- ローカルファイル走査、メディア配信、長時間運用は Rust/Go より不安が残る
- Bun は便利だが、長期運用で Node 標準前提の資産より選択肢が狭まる場合がある
- 今ある Rust 実装を捨てることになる

### 評価

**速度重視の再試作には向くが、mimimilli の性質上は最終形としてはやや弱い。**

## 5.4 推奨

第一候補は **Rust サーバー**。  
第二候補は **TypeScript + Node**。Bun は採用理由が明確な場合のみ。

Go は悪くないが、現状では「良い置き換え先」ではあっても「最短の再設計先」ではない。

## 6. 推奨技術スタック

## 6.1 フロントエンド

- **React 19**
- **TypeScript**
- **Vite**
- **TanStack Query**
- **TanStack Router** もしくは軽量なルーティング
- **Zustand** か React state でプレイヤー状態管理
- UI は既存の延長でよいが、スタイルは CSS Modules か plain CSS に寄せて再整理

補足:

- 今の `useLibrary` はクライアント側で全件フィルタしているが、件数が増えると限界が来る
- 次版では検索・ソートはサーバーAPI主体に寄せるべき

## 6.2 バックエンド

- **Rust**
- **axum**: HTTP API
- **tokio**: async runtime
- **rusqlite** または必要なら **sqlx + SQLite**
- **serde / serde_json**
- **notify**: ファイル監視
- **reqwest**
- **scraper**

補足:

- いまの `service.rs` を中心に、Tauri command 層を HTTP handler に置き換える
- 音声・画像配信は静的配信ではなく、認可とパストラバーサル対策を持つ専用エンドポイントにする

## 6.3 通信方式

- 通常操作: REST/JSON
- スキャン進捗: **SSE**
- 将来リアルタイム同期が必要なら WebSocket を追加

SSE で十分な理由:

- スキャン進捗や DLsite 取得状況は基本的にサーバー → クライアント片方向通知
- 実装とデバッグが WebSocket より単純

## 7. API 設計の方向性

設定・スキャン・作品基本 CRUD:

- `GET /api/settings` / `POST /api/settings`
- `POST /api/library/scan`
- `GET /api/library/works` （`q`, `tags`(AND), `axis`, `axisValue`, `sort`, `page`, `limit` クエリパラメータ）
- `GET /api/library/works/:id`
- `PUT /api/library/works/:id/tags`
- `PUT /api/library/works/:id/title`
- `POST /api/library/works/:id/bookmark`

軸ファセット集計（Libraryモード新規）:

- `GET /api/library/axes/:axis` — 指定軸（`circle` / `cv` / `series` / `category` / `tag` / `added_date`）のファセット値一覧＋件数を返す
- `GET /api/library/works?tags=A,B&tagOp=AND` — タグAND積集合検索

スマートフォルダー（新規）:

- `GET /api/library/smart-folders`
- `POST /api/library/smart-folders`
- `PUT /api/library/smart-folders/:id`
- `DELETE /api/library/smart-folders/:id`
- `GET /api/library/smart-folders/:id/works` — ルール評価結果（リアルタイム）

メディア配信:

- `GET /api/media/cover/:id`
- `GET /api/media/audio/:id/*path`
- `GET /api/media/files/:id/*path`

DLsite連携:

- `POST /api/integrations/dlsite/:id/fetch`
- `POST /api/integrations/dlsite/:id/apply`

## 8. フロント側の再設計ポイント

## 8.1 Tauri 依存の切り離し

現状のフロントは以下に Tauri 依存がある。

- `src/api.ts` の `invoke`
- `asset://localhost/...` 前提のメディアURL生成
- 初回セットアップ時のネイティブなフォルダ選択

ここは以下に置き換える。

- `invoke` -> `fetch` ベースの API client
- `asset://` -> `/api/media/...`
- フォルダ選択 -> サーバー設定UI経由

## 8.2 検索はサーバー主導にする

現状の `useLibrary.ts` はメモリ上の全作品をクライアントフィルタしている。これはプロトタイプとしては良いが、今後の本線では以下へ寄せるべき。

- クエリ文字列
- タグ条件
- ソート
- ページング

これらを API パラメータ化し、SQLite 側で検索する。

## 8.3 プレイヤーは Web のままでよい

プレイヤーは引き続きブラウザの Audio / Web Audio API で良い。

- 再生制御
- 再生速度
- L/R 入れ替え
- A-B リピート

これらは UI 側の責務として自然。  
一方で、**音声ファイルの所在解決と配信はサーバー責務**に寄せる。

## 9. データモデル方針

基本エンティティは維持する。

- `.meta.json` を SoT
- SQLite は検索用キャッシュ
- `Work`, `WorkSummary`, `Track`, `Playlist`, `UrlEntry` はほぼ維持

再構築で追加するエンティティ:

- `SmartFolder { id, name, rules: Vec<SmartFolderRule>, sort, created_at }` — スマートフォルダー保存クエリ
- `SmartFolderRule { conjunction, field, operator, values }` — WHERE/AND/AND NOT ＋ フィールド・演算子・値

DB に追加するテーブル:

- `smart_folders` — スマートフォルダー保存
- `smart_folder_rules` — ルール（FK: smart_folders.id）

意図的に**追加しないもの**（将来フェーズ）:

- 再生統計（playCount, totalListenedSec, completionRate）
- レーティング（rating）
- メモ（note）

これらはデータモデルに含めず、フェーズ3以降で設計する。未再生・ファイル欠損などのビュービューは既存の `lastPlayedAt`/`status` フィールドから導出する。

API 用 DTO / DB モデル / `.meta.json` モデルは再構築時に層を明確に分ける。

## 10. ディレクトリ構成案

```text
mimimilli/
├── apps/
│   ├── web/               # React + Vite
│   └── server/            # Rust API server
├── packages/
│   └── shared-types/      # OpenAPI or generated schema from server
├── docs/
└── sample-library/
```

Rust を使うなら、`server` の内部は概ね以下。

```text
server/src/
├── main.rs
├── api/
├── application/
├── domain/
├── infrastructure/
│   ├── db/
│   ├── fs/
│   ├── dlsite/
│   └── streaming/
└── models/
```

今の `service.rs` は `application/` に、`db.rs` と `scanner.rs` は `infrastructure/` に分けるイメージ。

## 11. 段階的移行プラン

## Phase 0: 設計の固定 [完了]

- Tauri を本線から外す
- API 契約を先に決める
- `.meta.json` スキーマは維持

## Phase 1: サーバー化 [完了]

- 既存 Rust サービス層を Tauri command から切り離す
- axum で HTTP 化（`server`）
- `/api/...` エンドポイントを実装
- スキャン、一覧、詳細、タグ更新、レジューム保存まで移植

## Phase 2: フロント移植 [進行中]

- `src/api.ts` を HTTP client に差し替え（完了）
- `asset://` 依存を削除（完了）
- フロントエンド全体を再構築中
- 検索をサーバーサイド化（未着手）

## Phase 3: 体験改善 [未着手]

- SSE でスキャン進捗を表示
- ファイル監視による自動反映
- DLsite 連携の再整理

## Phase 4: 必要なら配布形態を追加 [未着手]

- ローカルサーバー + ブラウザ起動の配布
- 後から Tauri / Electron / PWA ラッパーを検討

## 12. この再設計で得られるもの

- UI デバッグが通常の Web 開発になる
- フロントとバックエンドの責務が明確になる
- 将来のリモートアクセスに自然に伸ばせる
- 今の Rust 実装資産をかなり再利用できる
- Tauri 固有の不具合と戦う量を減らせる

## 13. 懸念点

- 「Web化」と言っても、ローカルサーバーは実質必須
- 配布は単純な静的サイトでは済まない
- ローカルファイルアクセスの権限モデルを設計する必要がある
- DLsite スクレイピングは仕様変更の影響を受け続ける

## 14. 最終提案

次の一手としては、以下が最も筋が良い。

1. **Tauri をやめ、React + Vite の Web UI を本線にする**
2. **バックエンドは Rust + axum でローカル API サーバー化する**
3. **既存 Rust の service/db/scanner/dlsite を再利用して HTTP 化する**
4. **メディア配信は `/api/media/...` に統一する**
5. **検索・ソート・スキャン進捗はサーバー主導へ寄せる**

要するに、**「ネイティブアプリを作る」のではなく、「ローカルで動く Web システムを作る」** と捉え直すのがよい。

この形が、mimimilli の要件と今後の拡張性に最も合っている。
