# mimikago

ローカル音声作品管理・再生アプリ。DLsiteやFANZAからダウンロードした音声作品を快適に管理・再生するためのローカルで動かす Web アプリ。

## 特徴

- **3ペインLibraryモード**: 軸レール（サークル/CV/タグ別ピボット）→ コンテンツ列 → プレビューの固定3ペインで大量作品を快適にブラウズ
- **タグAND積集合絞り込み**: 複数タグをANDで組み合わせてヒット件数をリアルタイム更新
- **スマートフォルダー**: WHERE/AND/AND NOT の保存クエリで作品を動的抽出
- **タグベースの管理**: フラットタグ・Annotatedタグ（`cv/名前`, `サークル/名前`）による柔軟な整理
- **メタファイル駆動**: `.meta.json`をSource of Truthとし、手動編集も可能
- **自動スキャン**: 音声ファイルを含むフォルダーからメタファイルを自動生成
- **常駐プレイヤー**: 作品を眺めながら再生を継続。全画面プレイヤーへ展開可能

## スクリーンショット

（開発中）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | axum + tokio (Rust) |
| フロントエンド | React 19 + TypeScript |
| ビルド | Vite 7 |
| データベース | SQLite (rusqlite, bundled) |
| 開発プロキシ | portless |
| パッケージマネージャ | pnpm |

## セットアップ

### 前提条件

- **Node.js** 18+
- **pnpm** 8+
- **Rust** 安定版（`rustup`経由でインストール推奨）
- **ffprobe**（音声メタデータ取得に使用。`ffmpeg` パッケージに同梱）

### インストールと起動

```bash
# リポジトリのクローン
git clone <repository-url>
cd mimikago

# フロントエンド依存関係
pnpm install

# フロントエンド開発サーバー起動（モック API で動作）
pnpm dev
# => http://mimi.localhost:1355
```

実際の axum バックエンドと接続する場合:

```bash
# 別ターミナルでバックエンドを起動
cd server
cargo run
# => http://localhost:8080

# フロントをバックエンドへ向けて起動
BACKEND_URL=http://localhost:8080 pnpm dev
```

`BACKEND_URL` を未設定のまま `pnpm dev` を実行すると、`vite.config.ts` 内のインメモリモック API が応答する（開発・UI確認用）。

## 使い方

1. 初回起動時にルートフォルダー（音声作品を保存しているフォルダー）を選択
2. 自動スキャンが実行され、作品が検出される
3. ライブラリ一覧からグリッド/テーブル表示で作品を閲覧
4. タグの追加・削除で作品を整理

### メタファイルについて

各作品フォルダー内に `.meta.json` を配置することで、作品として認識されます。スキャン時にメタファイルがないフォルダーは自動生成されます。

```jsonc
{
  "id": "uuid-xxxx-xxxx",
  "title": "作品タイトル",
  "urls": [{ "label": "DLsite", "url": "https://..." }],
  "tags": ["バイノーラル", "cv/名前", "サークル/名前"],
  "coverImage": "cover.jpg",
  "playlists": [{
    "name": "default",
    "tracks": [
      { "title": "導入", "file": "01_導入.mp3" },
      { "title": "本編", "file": "02_本編.mp3" }
    ]
  }],
  "defaultPlaylist": "default"
}
```

### キーボードショートカット

| キー | 機能 |
|------|------|
| `Space` | 再生/一時停止 |
| `Escape` | パネル・モーダルを閉じる |

## プロジェクト構造

```
mimikago/
├── src/             # フロントエンド (React + TypeScript)
│   ├── app/         # アプリルート・プロバイダー
│   ├── features/    # 機能単位のモジュール (library/player/scan/settings/setup)
│   ├── entities/    # ドメインエンティティ (work/)
│   └── shared/      # 共通ユーティリティ・UI・API クライアント
├── server/     # axum HTTP API サーバー (Rust)
│   └── src/
│       ├── main.rs          # ルーター定義
│       ├── handlers/        # HTTP ハンドラ
│       ├── service.rs       # ビジネスロジック
│       ├── db.rs            # SQLite 操作
│       ├── scanner.rs       # ファイルシステムスキャナー
│       ├── dlsite.rs        # DLsite スクレイパー
│       └── models.rs        # データモデル
├── mocks/           # 開発用インメモリ API (fixtures/ + handlers/)
├── tests/
│   ├── unit/        # vitest 単体テスト
│   └── visual/      # Playwright ビジュアルリグレッションテスト
└── docs/            # 設計ドキュメント・デザイン資料
    └── design_handoff_mimimilli_library/  # デザイン正典 (mimimilli)
```

## ライセンス

Private
