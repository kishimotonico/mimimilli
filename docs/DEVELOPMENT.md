# 開発者ガイド

## アーキテクチャ

### バックエンド（Rust）

サービス層パターンを採用。将来のリモートストリーミング対応時にHTTPサーバーとして同じロジックを公開できるよう設計。

```
Tauriコマンド (commands.rs)
    ↓ 薄いラッパー
サービス層 (service.rs)
    ↓ ビジネスロジック
データベース (db.rs) / スキャナー (scanner.rs)
```

#### 主要モジュール

- **`commands.rs`**: Tauriコマンドの定義。`State<Mutex<AppService>>`経由でサービス層にアクセス
- **`service.rs`**: ルートフォルダー管理、スキャン実行、タグ更新、メタファイル書き戻し等のビジネスロジック
- **`db.rs`**: SQLiteのCRUD操作。Mutex保護のConnectionを使用。WALモード有効
- **`scanner.rs`**: ファイルシステムの再帰スキャン。`.meta.json`検出と自動生成
- **`models.rs`**: 全データモデル。`serde`による`camelCase`シリアライゼーション

#### データベーススキーマ

```sql
works          -- 作品テーブル（urls_json, playlists_jsonはJSON列）
tags           -- タグマスタ
work_tags      -- 多対多リレーション
app_settings   -- アプリ設定（KVストア）
```

#### セキュリティ

- パストラバーサル防止: `get_audio_file_path`/`get_cover_image_path`で`canonicalize()` + `starts_with()`検証
- Mutex poisoning対策: 全ての`lock()`に`map_err()`でエラー伝搬
- JSON serialization: `unwrap_or_default()`ではなく`map_err()`でエラー伝搬

### フロントエンド（React + TypeScript）

インラインスタイルで全UIを構築（CSS-in-JSライブラリ不使用）。CSS変数は`global.css`で定義。

#### 主要フック

- **`usePlayer`**: HTML5 Audio要素の管理。再生/停止/シーク/音量/ループ/トラック切り替え
- **`useLibrary`**: 作品一覧の取得、フィルタリング、ソート、タグ更新

#### コンポーネント構成

```
App.tsx
├── Header              # 検索バー、表示モード切り替え
├── SearchConditionsBar  # フィルター条件の表示、ソート
├── LibraryGrid/Table   # 作品一覧（グリッド/テーブル表示）
│   └── WorkCard        # グリッド内の個別カード
├── DetailPanel         # クイックビュー（右パネル）
├── FullView            # 作品フルビュー
├── PlayerBar           # 固定プレイヤーバー
├── FullScreenPlayer    # フル画面プレイヤー
├── SettingsModal       # 設定ダイアログ
├── NewWorkPopup        # スキャン結果・新規作品通知
└── SetupScreen         # 初回セットアップ
```

## 開発コマンド

```bash
# 開発サーバー起動（ブラウザ用）
pnpm dev
# => http://mimi.localhost:1355

# デスクトップアプリ起動（内部的に pnpm dev を使う）
pnpm tauri dev

# TypeScript型チェック
npx tsc --noEmit

# フロントエンドのみビルド
npx vite build

# Rustのみチェック
cargo check --manifest-path src-tauri/Cargo.toml

# プロダクションビルド
pnpm tauri build
```

`pnpm dev` は `PORTLESS_HTTPS=0 PORTLESS_PORT=1355` 付きで `portless` 経由の Vite を起動する。Vite の実ポートは `portless` が空きを自動選択し、アクセス先だけを常に `http://mimi.localhost:1355` に固定するため、sudo なしで別シェルの既存サーバーとも衝突しにくい。

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
5. 最終的に行方不明のまま残った作品 = 物理パスが見つからない

### 音声再生フロー

1. フロントエンドでトラック選択
2. `asset://localhost/`プロトコルでパスを構築（各セグメントをencodeURIComponent）
3. HTML5 Audio要素の`src`に設定
4. `play()`で再生開始、イベントリスナーで状態同期

## 既知の制約

- Raspberry Pi (aarch64) でのRustコンパイルは非常に遅い（初回30分以上）
- `window.__TAURI__`チェックにより、ブラウザ単体ではカバー画像・音声再生不可
- CSS変数を定義しているが、コンポーネント内ではインラインスタイルでハードコード（プロトタイプ段階）
- 検索はクライアントサイドのフィルタリング（大量データではパフォーマンス検討要）

## フェーズ2以降の実装予定

詳細は`docs/requirements-v4.md`を参照。主な項目:

- DLsiteスクレイピングによるタグ自動取得
- ブックマーク・レジューム機能
- L/R入れ替え
- フォルダービュー（ファイルタブ）
- リモートストリーミング
