# mimikago

ローカル音声作品管理・再生アプリ。DLsiteやFANZAからダウンロードした音声作品を快適に管理・再生するためのデスクトップアプリケーション。

## 特徴

- **タグベースの管理**: フラットタグ・Annotatedタグ（`cv/名前`, `サークル/名前`）による柔軟な検索
- **物理フォルダーとの両立**: ユーザーの自由なフォルダー構造をそのまま利用
- **メタファイル駆動**: `.meta.json`をSource of Truthとし、手動編集も可能
- **ダークテーマUI**: ASMR作品のリスニングに適した目に優しいデザイン
- **自動スキャン**: 音声ファイルを含むフォルダーからメタファイルを自動生成

## スクリーンショット

（開発中）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Tauri v2 (Rust + WebView2) |
| フロントエンド | React 19 + TypeScript |
| ビルド | Vite |
| データベース | SQLite (rusqlite, bundled) |
| パッケージマネージャ | pnpm |

## セットアップ

### 前提条件

- **Node.js** 18+
- **pnpm** 8+
- **Rust** 1.75+（`rustup`経由でインストール推奨）
- **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf` 等
- **Windows**: WebView2（Windows 10以降は標準搭載）
- **portless 初回セットアップ**: `pnpm dev` / `pnpm tauri dev` は HTTP の `mimi.localhost:1355` を使う

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd mimikago

# フロントエンド依存関係
pnpm install

# ブラウザで開発サーバー起動
pnpm dev
# => http://mimi.localhost:1355

# 開発モードで起動
pnpm tauri dev

# プロダクションビルド
pnpm tauri build
```

## 使い方

1. 初回起動時にルートフォルダー（音声作品を保存しているフォルダー）を選択
2. 自動スキャンが実行され、作品が検出される
3. ライブラリ一覧からグリッド/テーブル表示で作品を閲覧
4. シングルクリックでクイックビュー、ダブルクリックで作品フルビュー
5. タグの追加・削除で作品を整理
6. トラックをクリックして再生開始

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
├── src/                    # フロントエンド (React + TypeScript)
│   ├── components/         # UIコンポーネント
│   ├── hooks/              # カスタムフック (usePlayer, useLibrary)
│   ├── api.ts              # Tauriコマンド呼び出し
│   ├── types.ts            # 型定義
│   └── App.tsx             # アプリケーションルート
├── src-tauri/              # Rustバックエンド
│   └── src/
│       ├── lib.rs          # Tauriセットアップ
│       ├── commands.rs     # Tauriコマンドハンドラ
│       ├── service.rs      # ビジネスロジック
│       ├── db.rs           # SQLiteデータベース操作
│       ├── scanner.rs      # ファイルシステムスキャナー
│       └── models.rs       # データモデル
└── docs/                   # 設計ドキュメント
```

## ライセンス

Private
