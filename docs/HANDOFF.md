# 引き継ぎドキュメント

このドキュメントは mimikago プロジェクトの現状と今後の作業を後任が把握するためのものです。

## プロジェクト概要

DLsite/FANZAからダウンロードした音声作品（ASMR等）をローカルで管理・再生するアプリ。タグベースの検索と物理フォルダー管理を両立する設計。

**技術スタック:** axum 0.8 + tokio (Rust) + React 19 + TypeScript + SQLite (rusqlite) + Vite 7 + pnpm

## 現在のステータス

Tauri から axum サーバー構成へ移行済み。フロントエンド `src/` は現在ほぼゼロから再構築中（既存コンポーネント・フックは参照のみ）。

```
npx tsc --noEmit                                    → エラーなし（フロント）
cargo check --manifest-path apps/server/Cargo.toml → OK
```

## アーキテクチャ

### バックエンド（Rust — apps/server/）

サービス層パターンを採用。

```
HTTP Handler (handlers/*.rs) → 薄いラッパー
  ↓
サービス層 (service.rs) → ビジネスロジック
  ↓
DB (db.rs) / スキャナー (scanner.rs) / DLsiteスクレイパー (dlsite.rs)
```

**モジュール一覧:**

| ファイル | 責務 |
|---------|------|
| `main.rs` | axum Router 定義、`AppService` の初期化 |
| `handlers/settings.rs` | `GET/POST /api/settings` |
| `handlers/library.rs` | スキャン・作品CRUD・タグ・プリセット |
| `handlers/media.rs` | カバー画像・音声・ファイル配信 |
| `handlers/integrations.rs` | DLsite fetch/apply |
| `service.rs` | ルートフォルダー管理、スキャン、タグ更新、メタファイル書き戻し、DLsite連携 |
| `db.rs` | SQLite CRUD。WALモード |
| `scanner.rs` | ファイルシステム再帰走査、`.meta.json` 検出・自動生成、IDベース移動追従 |
| `dlsite.rs` | DLsiteスクレイピング。HTMLパース、RJコード抽出、カバー画像ダウンロード |
| `models.rs` | 全データモデル。`serde`の`camelCase`シリアライゼーション |

**エンドポイント一覧:**

| メソッド | パス | 概要 |
|---------|------|------|
| `GET` | `/api/settings` | 設定取得 |
| `POST` | `/api/settings` | 設定更新（ルートフォルダー等） |
| `POST` | `/api/scan` | ライブラリスキャン実行 |
| `POST` | `/api/export` | ライブラリJSONエクスポート |
| `GET` | `/api/works` | 作品一覧取得 |
| `GET` | `/api/works/:id` | 作品詳細取得 |
| `PUT` | `/api/works/:id/tags` | タグ更新 |
| `PUT` | `/api/works/:id/title` | タイトル更新 |
| `POST` | `/api/works/:id/bookmark` | ブックマーク切り替え |
| `POST` | `/api/works/:id/last-played` | 最終再生日時更新 |
| `POST` | `/api/works/:id/resume` | レジューム位置保存 |
| `GET` | `/api/works/:id/files` | 物理ファイル一覧取得 |
| `GET` | `/api/tags` | 全タグ一覧取得 |
| `GET` | `/api/presets` | 検索プリセット一覧 |
| `POST` | `/api/presets` | 検索プリセット保存 |
| `DELETE` | `/api/presets/:id` | 検索プリセット削除 |
| `GET` | `/api/works/:id/cover` | カバー画像配信 |
| `GET` | `/api/audio/:id/*path` | 音声ファイル配信 |
| `GET` | `/api/files/:id/*path` | 物理ファイル配信 |
| `POST` | `/api/dlsite/:id/fetch` | DLsite情報取得 |
| `POST` | `/api/dlsite/:id/apply` | DLsite情報適用 |

**DBスキーマ:**

| テーブル | 用途 |
|---------|------|
| `works` | 作品テーブル（`urls_json`, `playlists_json`はJSON列、`bookmarked`, `last_played_at`, `resume_position`, `resume_track_index`を含む） |
| `tags` | タグマスタ |
| `work_tags` | 多対多リレーション |
| `app_settings` | KVストア（ルートフォルダー、最終スキャン日時等） |
| `search_presets` | 検索プリセット保存 |

**Rust依存関係（主要）:** axum 0.8, tokio, tower-http (cors), rusqlite 0.31 (bundled), walkdir 2, uuid 1, chrono 0.4, serde/serde_json 1, reqwest 0.12 (blocking, rustls-tls, cookies), scraper 0.22, env_logger

### フロントエンド（React + TypeScript — src/）

**現在再構築中。** 確定次第このセクションを補完する。

API 層は `src/api.ts` が `/api` を fetch ベースで呼び出す HTTP client として実装されている。型定義は `src/types.ts`（`Work`, `WorkSummary`, `ScanResult`, `SearchPreset`, `FileEntry`, `DlsiteWorkInfo`）。

**フロント依存関係:** react 19, react-dom 19, portless（開発サーバー固定ポート用）

## データフロー

### メタファイルとDBの関係

```
.meta.json (Source of Truth)
  ↓ スキャン時に読み込み
SQLite DB (パフォーマンスキャッシュ)
  ↓ UIから編集時
.meta.json に書き戻し（同一操作内）
```

### スキャンフロー

1. `mark_all_missing()` で全作品を「行方不明」にマーク
2. ルートフォルダーを再帰走査し `.meta.json` を検出
3. 見つかった作品は `mark_found()` で「正常」に復帰（ブックマーク・レジューム情報は保持）
4. メタファイルのないフォルダーに音声ファイルがあれば `.meta.json` を自動生成
5. IDベースの移動追従：同一IDで異なるパスの作品を検出し、パスを更新
6. 最終的にmissingのまま残った作品 = 物理パスが消失

### 音声再生フロー

1. フロントエンドでトラック選択
2. `/api/audio/:id/*path` で音声を HTTP ストリーミング取得
3. HTML5 Audio の `src` に設定して再生
4. イベントリスナーで状態同期（`timeupdate`, `durationchange`, `ended`, `play`, `pause`）
5. レジューム位置を5秒ごとに `POST /api/works/:id/resume` で自動保存

### DLsiteスクレイピングフロー

1. FullView の「DLsite情報を取得」ボタンをクリック → `POST /api/dlsite/:id/fetch`
2. サーバー側でフォルダ名 → タイトルの順でRJコードを自動検出
3. `reqwest` でDLsiteのHTMLを取得（Cookie `adultchecked=1` で年齢確認バイパス）
4. `scraper` クレートで以下を抽出:
   - タイトル: `#work_name`
   - サークル名: `span.maker_name a`
   - CV: `<th>声優</th>` の親行内の `<td> a`
   - ジャンルタグ: `div.main_genre a`
   - カバー画像: `div.product-slider-data div[data-src]`
5. フロントでプレビューUI表示後、ユーザーが「すべて適用」「タグのみ」「タイトルのみ」を選択
6. 「適用」で `POST /api/dlsite/:id/apply` → DB・メタファイルに書き戻し

## バックエンドで確認済みの機能

### 実装済み（API レベルで保証）

- ルートフォルダー指定と設定保存
- フルスキャン（手動 + axum エンドポイント経由）
- `.meta.json` の読み書き + 自動生成
- IDベースの作品移動追従
- タグの追加・削除・テキスト検索
- 作品タイトル編集
- 複数URLの保存
- ブックマーク切り替え
- レジューム再生（再生位置保存・復元）
- 最終再生日時の記録
- 検索プリセットの保存・適用・削除
- フォルダービュー（物理ファイル一覧取得）
- ライブラリエクスポート（JSON）
- DLsiteスクレイピング（タイトル、サークル、CV、ジャンルタグ、カバー画像）
- カバー画像・音声・物理ファイルの HTTP 配信

### フロント再構築中

プレイヤー UI（再生速度、L⇄R 入替、A-B リピート、フル画面プレイヤー）等は、フロントエンド再構築後に順次復元・確定する。

## セキュリティ対策

| 項目 | 対策 |
|------|------|
| パストラバーサル | `get_audio_file_path`/`get_cover_image_path`で`canonicalize()` + `starts_with()`検証 |
| Mutex poisoning | 全`lock()`に`map_err()`でエラー伝搬（panicしない） |
| JSONシリアライゼーション | `map_err()`で明示的エラー処理 |
| DLsiteスクレイピング | 認証情報不要、Cookie最小限（`adultchecked=1`のみ） |

## 実装上の注意点（サーバー側）

### DLsiteスクレイピングのセレクタ

実際のDLsite HTMLで検証済み（2026年3月時点）。DLsiteのHTML構造が変更された場合は `dlsite.rs` のセレクタ修正が必要。

| セレクタ | 対象 |
|---------|------|
| `#work_name` | 作品タイトル（`<h1 id="work_name">`） |
| `span.maker_name a` | サークル名 |
| `th`内「声優」→ 親の`td a` | CV名 |
| `div.main_genre a` | ジャンルタグ |
| `div.product-slider-data div[data-src]` | カバー画像URL |

## 既知の制約

- ブラウザ単体ではバックエンドが必須（カバー画像・音声は `/api/...` 経由で配信）。`pnpm dev` のみの場合はモック API が代替応答する
- 検索はクライアントサイドフィルタリング（大量データではパフォーマンス要検討）
- 合計再生時間は`start`/`end`指定がある場合のみ計算可能

## Phase 3以降の未実装項目

要件定義の全文は `docs/requirements-v4.md` を参照。

- バックグラウンド再生 + グローバルホットキー
- ギャップレス再生
- 作品横断プレイリスト
- プレイヤーバーのフローティングモード
- DLsite自動スクレイピング（スキャン時にRJコード検出で自動取得）
- 差分スキャン（変更検出による高速化）
- SSE によるスキャン進捗リアルタイム通知
- ファイル監視（watcherによるリアルタイム検知）

## 開発環境

```bash
# フロントエンド開発サーバー起動（モック API）
pnpm dev
# => http://mimi.localhost:1355

# バックエンド起動
cd apps/server && cargo run
# => http://localhost:8080

# フロントを実バックエンドに向けて起動
BACKEND_URL=http://localhost:8080 pnpm dev

# TypeScript型チェック
npx tsc --noEmit

# Rustのみチェック
PATH="$HOME/.cargo/bin:$PATH" cargo check --manifest-path apps/server/Cargo.toml
```

`pnpm dev` は `PORTLESS_HTTPS=0 PORTLESS_PORT=1355 portless run --name mimi vite` を使う。ブラウザからは常に `http://mimi.localhost:1355` でアクセスする。

## 関連ドキュメント

| ファイル | 内容 |
|---------|------|
| `README.md` | ユーザー向けの概要・セットアップ手順 |
| `docs/requirements-v4.md` | 要件定義（Phase 1〜3） |
| `docs/ui-design-v1.md` | UI設計書 |
| `docs/DEVELOPMENT.md` | 開発者ガイド |
| `docs/web-architecture-proposal.md` | Tauri廃止・axumサーバー化の設計経緯 |
