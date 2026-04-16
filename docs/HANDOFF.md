# 引き継ぎドキュメント

このドキュメントは mimikago プロジェクトの現状と今後の作業を後任が把握するためのものです。

## プロジェクト概要

DLsite/FANZAからダウンロードした音声作品（ASMR等）をローカルで管理・再生するデスクトップアプリ。タグベースの検索と物理フォルダー管理を両立する設計。

**技術スタック:** Tauri v2 (Rust) + React 19 + TypeScript + SQLite + Vite + pnpm

## 現在のステータス

Phase 1完了、Phase 2の大部分を実装済み。ビルドは全て通る状態。

```
npx tsc --noEmit     → エラーなし
cargo check          → OK
```

## アーキテクチャ

### バックエンド（Rust）

サービス層パターンを採用。将来のHTTPサーバー化（リモートストリーミング）を見据えた設計。

```
Tauriコマンド (commands.rs) → 薄いラッパー
  ↓
サービス層 (service.rs) → ビジネスロジック
  ↓
DB (db.rs) / スキャナー (scanner.rs) / DLsiteスクレイパー (dlsite.rs)
```

**モジュール一覧:**

| ファイル | 責務 |
|---------|------|
| `lib.rs` | Tauriアプリの初期化、プラグイン登録、コマンドハンドラ登録 |
| `commands.rs` | Tauriコマンド定義。`State<Mutex<AppService>>`経由でサービス層にアクセス |
| `service.rs` | ルートフォルダー管理、スキャン、タグ更新、メタファイル書き戻し、DLsite連携 |
| `db.rs` | SQLite CRUD。Mutex保護のConnection、WALモード |
| `scanner.rs` | ファイルシステム再帰走査、`.meta.json`検出・自動生成、IDベース移動追従 |
| `dlsite.rs` | DLsiteスクレイピング。HTMLパース、RJコード抽出、カバー画像ダウンロード |
| `models.rs` | 全データモデル。`serde`の`camelCase`シリアライゼーション |

**DBスキーマ:**

| テーブル | 用途 |
|---------|------|
| `works` | 作品テーブル（`urls_json`, `playlists_json`はJSON列、`bookmarked`, `last_played_at`, `resume_position`, `resume_track_index`を含む） |
| `tags` | タグマスタ |
| `work_tags` | 多対多リレーション |
| `app_settings` | KVストア（ルートフォルダー、最終スキャン日時等） |
| `search_presets` | 検索プリセット保存 |

**Rust依存関係（主要）:** tauri 2, rusqlite 0.31 (bundled), walkdir 2, uuid 1, chrono 0.4, serde/serde_json 1, reqwest 0.12 (blocking, cookies), scraper 0.22

### フロントエンド（React + TypeScript）

インラインスタイルで全UIを構築（CSSフレームワーク不使用）。CSS変数は`global.css`で定義。

**コンポーネント構成:**

```
App.tsx
├── Header              # 検索バー、表示モード切り替え、スキャンボタン
├── SearchConditionsBar  # フィルター条件表示、ソート選択、検索プリセット管理
├── LibraryGrid         # グリッド表示
│   └── WorkCard        # 個別カード（ブックマーク表示対応）
├── LibraryTable        # テーブル表示
├── DetailPanel         # クイックビュー（右パネル、ブックマーク切り替え対応）
├── FullView            # 作品フルビュー（DLsite情報取得・適用UI付き）
├── PlayerBar           # 固定プレイヤーバー（再生速度、L/R入替、A-Bリピート対応）
├── FullScreenPlayer    # フル画面プレイヤー（同上）
├── SettingsModal       # 設定ダイアログ（エクスポート機能付き）
├── NewWorkPopup        # スキャン結果ポップアップ
├── SetupScreen         # 初回セットアップ
├── CoverImage          # カバー画像（プレースホルダー、エラー、行方不明表示付き）
└── UrlButtons          # URL外部リンクボタン
```

**カスタムフック:**

| フック | 責務 |
|-------|------|
| `usePlayer` | HTML5 Audio管理。再生/停止/シーク/音量/ループ/トラック切り替え/±10秒ジャンプ/再生速度/L⇄R入替/A-Bリピート/レジューム保存 |
| `useLibrary` | 作品一覧取得、高度なフィルタリング（AND/OR/除外）、ソート（9種）、スキャン実行、タグ更新、ブックマーク、検索プリセット管理 |

**フロントエンド依存関係:** react 19, react-dom 19, @tauri-apps/api 2, @tauri-apps/plugin-dialog 2

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
2. `asset://localhost/` プロトコルでパス構築（各セグメントを`encodeURIComponent`）
3. HTML5 Audio の `src` に設定して再生
4. イベントリスナーで状態同期（`timeupdate`, `durationchange`, `ended`, `play`, `pause`）
5. レジューム位置を5秒ごとに自動保存

### DLsiteスクレイピングフロー

1. FullViewの「DLsite情報を取得」ボタンをクリック
2. フォルダ名 → タイトルの順でRJコードを自動検出
3. `reqwest`でDLsiteのHTMLを取得（Cookie `adultchecked=1` で年齢確認バイパス）
4. `scraper`クレートで以下を抽出:
   - タイトル: `#work_name`
   - サークル名: `span.maker_name a`
   - CV: `<th>声優</th>` の親行内の `<td> a`
   - ジャンルタグ: `div.main_genre a`
   - カバー画像: `div.product-slider-data div[data-src]`
5. プレビューUI表示後、ユーザーが「すべて適用」「タグのみ」「タイトルのみ」を選択
6. タグは `CV/名前`、`サークル/名前` のプレフィックス形式で追加
7. DLsite作品URLも自動追加、カバー画像はダウンロードして保存

## 実装済み機能

### Phase 1（完了）

**ライブラリ管理:**
- ルートフォルダー指定と初期セットアップフロー
- フルスキャン（手動 + 起動時自動）
- `.meta.json` の読み書き + 自動生成
- スキャン結果サマリー表示
- SQLite作品・タグ管理
- タグの追加・削除・テキスト検索
- 作品タイトル編集
- 複数URLの表示・外部ブラウザで開く

**表示:**
- グリッド表示（カバーサイズ4段階: S/M/L/XL）
- テーブル表示（ミニカバー付き）
- 表示モード切り替え（グリッド/テーブル）
- クイックビュー（右パネル）
- 作品フルビュー

**プレイヤー:**
- 再生/一時停止/停止
- シーク（シークバー）、±10秒ジャンプ、音量調整
- ループ再生、トラック切り替え、連続再生
- プレイヤーバー + フル画面プレイヤー

**その他:**
- Space: 再生/一時停止、Escape: パネル・モーダルを閉じる
- カバー画像上のエラーアイコン、行方不明作品の半透明表示
- 音声ファイル欠損の検出

### Phase 2（実装済み）

**DLsiteスクレイピング:**
- RJコード自動検出（フォルダ名・タイトルから）
- DLsite作品ページのスクレイピング（タイトル、サークル、CV、ジャンルタグ、カバー画像）
- 年齢確認ページの自動バイパス（Cookie）
- 取得情報のプレビュー表示と選択適用UI
- カバー画像のダウンロード・保存

**ブックマーク・レジューム:**
- ブックマーク切り替え（DB保存、グリッド/詳細/フルビューに表示）
- レジューム再生（再生位置を5秒ごとに自動保存、次回再生時に復帰）
- 最終再生日時の記録・表示

**プレイヤー拡張:**
- 再生速度変更（0.5x / 0.75x / 1.0x / 1.25x / 1.5x / 2.0x サイクル切り替え）
- L⇄R チャンネル入れ替え（Web Audio API ChannelSplitter/Merger）
- A-Bリピート（シークバー上のマーカー表示、区間ハイライト付き）

**検索・ソート:**
- 高度な検索構文（AND: スペース区切り、OR: `|`区切り、除外: `-`プレフィックス）
- 並び替え9種（追加日新旧、タイトルA-Z/Z-A、再生時間長短、最近再生、ランダム、ID順）
- 検索プリセットの保存・適用・削除

**ファイル管理:**
- フォルダービュー（作品フルビューのファイルタブ、ツリー表示）
- 画像プレビュー（フォルダービュー内）
- ライブラリエクスポート（JSON）

**スキャナー改善:**
- 起動時自動スキャン
- IDベースの作品移動追従（フォルダ名変更・移動に対応）
- ブックマーク・レジューム情報の再スキャン時保持

**その他:**
- 複数プレイリスト選択UI
- 検索条件バーに検索プリセット管理

## セキュリティ対策

| 項目 | 対策 |
|------|------|
| パストラバーサル | `get_audio_file_path`/`get_cover_image_path`で`canonicalize()` + `starts_with()`検証 |
| Mutex poisoning | 全`lock()`に`map_err()`でエラー伝搬（panicしない） |
| JSONシリアライゼーション | `map_err()`で明示的エラー処理 |
| DLsiteスクレイピング | 認証情報不要、Cookie最小限（`adultchecked=1`のみ） |

## 実装上の注意点

### loopRefパターン（usePlayer.ts）

`usePlayer`のAudioイベントリスナーは`useEffect([], [])`で1回だけ登録し、`loop`状態は`loopRef`経由で参照する。これにより`state.loop`変更時のリスナー再登録・蓄積を防止している。

```typescript
const loopRef = useRef(false);
loopRef.current = state.loop;

useEffect(() => {
  const onEnded = () => {
    if (loopRef.current) { /* loop */ } else { /* auto-advance */ }
  };
  audio.addEventListener("ended", onEnded);
  return () => audio.removeEventListener("ended", onEnded);
}, []); // 依存配列は空
```

### ダブルクリック検出（WorkCard, LibraryTable）

`onClick`で200msタイマーを設定し、200ms以内の2回目クリックでダブルクリックとして処理。React の `onDoubleClick` は使わず独自実装（シングルクリックとの共存のため）。アンマウント時のタイマークリーンアップ必須。

### 検索デバウンス（Header）

検索入力は`localQuery`（即座に反映）と`searchQuery`（200ms遅延）の2段構成。ローカルstateで入力の即時フィードバックを確保しつつ、フィルタリング処理の負荷を軽減。

### asset://プロトコル

Tauriの`asset://localhost/`プロトコルでローカルファイルを配信。パス内の各セグメントを個別に`encodeURIComponent`する必要がある（日本語パス対応）。`window.__TAURI__`の存在チェックでブラウザ単体実行時のフォールバック。

### Web Audio API チャンネル入替

L/R入替はChannelSplitter(2ch)→ChannelMerger(2ch)で実現。AudioContextはユーザー操作後に遅延初期化する必要がある（ブラウザのAutoplay Policy対応）。

### DLsiteスクレイピングのセレクタ

実際のDLsite HTMLで検証済み（2026年3月時点）。DLsiteのHTML構造が変更された場合は`dlsite.rs`のセレクタ修正が必要。

| セレクタ | 対象 |
|---------|------|
| `#work_name` | 作品タイトル（`<h1 id="work_name">`） |
| `span.maker_name a` | サークル名 |
| `th`内「声優」→ 親の`td a` | CV名 |
| `div.main_genre a` | ジャンルタグ |
| `div.product-slider-data div[data-src]` | カバー画像URL |

## 既知の制約

- Raspberry Pi (aarch64) でのRustコンパイルは遅い（新規クレート含む初回は長い）
- `cargo`は`$HOME/.cargo/bin/cargo`にあり、デフォルトPATHに含まれない場合がある
- `window.__TAURI__`チェックにより、ブラウザ単体ではカバー画像・音声再生不可
- CSS変数を定義しているが、コンポーネント内はインラインスタイルでハードコード
- 検索はクライアントサイドフィルタリング（大量データではパフォーマンス要検討）
- 合計再生時間は`start`/`end`指定がある場合のみ計算可能

## Phase 3以降の未実装項目

要件定義の全文は `docs/requirements-v4.md` を参照。

- バックグラウンド再生 + グローバルホットキー
- ギャップレス再生
- 作品横断プレイリスト
- プレイヤーバーのフローティングモード
- リモートストリーミング（Rust側のHTTPサーバー化）
- DLsite自動スクレイピング（スキャン時にRJコード検出で自動取得）
- 差分スキャン（変更検出による高速化）

## 開発環境

```bash
# 開発サーバー起動
pnpm dev
# => http://mimi.localhost:1355

# Tauri 開発起動
pnpm tauri dev

# TypeScript型チェック
npx tsc --noEmit

# Rustのみチェック（PATHにcargoがない場合）
PATH="$HOME/.cargo/bin:$PATH" cargo check --manifest-path src-tauri/Cargo.toml

# プロダクションビルド
pnpm tauri build
```

`pnpm dev` は `PORTLESS_HTTPS=0 PORTLESS_PORT=1355 portless run --name mimi vite` を使う。実際の Vite 待受ポートは固定しないが、ブラウザと Tauri からは `http://mimi.localhost:1355` を使ってアクセスする。

## 関連ドキュメント

| ファイル | 内容 |
|---------|------|
| `README.md` | ユーザー向けの概要・セットアップ手順 |
| `docs/requirements-v4.md` | 要件定義（Phase 1〜3） |
| `docs/ui-design-v1.md` | UI設計書 |
| `docs/DEVELOPMENT.md` | 開発者ガイド |
