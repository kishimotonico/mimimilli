# 開発者ガイド

## アーキテクチャ

### バックエンド（Rust — server/）

サービス層パターンを採用。

```
HTTP Handler (handlers/*.rs)
    ↓ 薄いラッパー
サービス層 (service.rs)
    ↓ ビジネスロジック
データベース (db.rs) / スキャナー (scanner.rs)
```

**主要モジュール:**

- **`main.rs`**: axum Router 定義。`AppService` の初期化と全エンドポイントのマッピング
- **`handlers/`**: HTTP ハンドラ（settings / library / media / integrations）
- **`service.rs`**: ルートフォルダー管理、スキャン実行、タグ更新、メタファイル書き戻し等のビジネスロジック
- **`db.rs`**: SQLiteのCRUD操作。Mutex保護のConnectionを使用。WALモード有効
- **`scanner.rs`**: ファイルシステムの再帰スキャン。`.meta.json`検出と自動生成、IDベース移動追従
- **`dlsite.rs`**: DLsiteスクレイピング。HTMLパース、RJコード抽出、カバー画像ダウンロード
- **`models.rs`**: 全データモデル。`serde`による`camelCase`シリアライゼーション

**データベーススキーマ:**

```sql
works          -- 作品テーブル（urls_json, playlists_jsonはJSON列）
tags           -- タグマスタ
work_tags      -- 多対多リレーション
app_settings   -- アプリ設定（KVストア）
search_presets -- 検索プリセット
```

**セキュリティ:**

- パストラバーサル防止: `get_audio_file_path`/`get_cover_image_path`で`canonicalize()` + `starts_with()`検証
- Mutex poisoning対策: 全ての`lock()`に`map_err()`でエラー伝搬
- JSON serialization: `unwrap_or_default()`ではなく`map_err()`でエラー伝搬

### フロントエンド（React + TypeScript — src/）

**現在再構築中。** `src/api.ts` が `/api` を fetch ベースで呼び出す HTTP client として実装されている。型定義は `src/types.ts`。

## 開発コマンド

```bash
# フロントエンド開発サーバー起動（モック API で動作）
pnpm dev
# => http://mimi.localhost:1355

# バックエンドを起動
cd server && cargo run
# => http://localhost:8080

# フロントを実バックエンドに向けて起動
BACKEND_URL=http://localhost:8080 pnpm dev

# TypeScript型チェック
npx tsc --noEmit

# フロントエンドのみビルド
npx vite build

# Rustのみチェック
PATH="$HOME/.cargo/bin:$PATH" cargo check --manifest-path server/Cargo.toml

# テスト
pnpm test
```

`pnpm dev` は `PORTLESS_HTTPS=0 PORTLESS_PORT=1355` 付きで `portless` 経由の Vite を起動する。ブラウザからは常に `http://mimi.localhost:1355` でアクセスする。

`BACKEND_URL` が未設定のとき、Vite の `vite.config.ts` 内インメモリモック API が `/api` リクエストを全て処理する（実ファイルは返さない）。

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

1. `mark_all_missing()` - 全既存作品を「行方不明」に設定
2. ファイルツリーを走査し`.meta.json`を検出
3. 見つかった作品は`mark_found()`で「正常」に復帰
4. メタファイルのない音声フォルダーには`.meta.json`を自動生成
5. IDベースの突合で移動・リネームした作品のパスを更新
6. 最終的に行方不明のまま残った作品 = 物理パスが見つからない

### 音声再生フロー

1. フロントエンドでトラック選択
2. `/api/audio/:id/*path` でパスを構築
3. HTML5 Audio 要素の `src` に設定
4. `play()` で再生開始、イベントリスナーで状態同期

## 既知の制約

- Raspberry Pi (aarch64) でのRustコンパイルは非常に遅い（初回30分以上）
- ブラウザ単体では `/api/...` へのリクエストが失敗する（バックエンドか `pnpm dev` のモックが必要）
- 検索はサーバーサイド処理へ移行予定（現フロントのクライアントサイドフィルタリングは廃止）

## 今後の実装予定

詳細は `docs/requirements-v4.md` を参照。現在の優先順:

1. mimimilli デザインシステム移植 + 共通シェル（tokens.css / フォント / シェルグリッド）
2. Library モード本体（3ペイン・軸ピボット・タグAND・スマートフォルダー）
3. バックエンド再構築（軸ファセット集計・タグAND・スマートフォルダー CRUD/評価）
4. プレイヤー・周辺画面の新デザイン化

将来フェーズ: SSEスキャン進捗・ファイル監視・DLsite自動スクレイピング・バックグラウンド再生・ギャップレス再生
