# 引き継ぎドキュメント

mimimilli の現状と進行中の作業を、後続のエージェント／セッションが把握するための資料。
最終更新: 2026-07-03。

## このアプリは何か

DLsite/FANZA 等からダウンロードした音声作品（ASMR・ボイスドラマ等）をローカルで管理・再生する常駐 Web アプリ。タグ／分類軸ベースの検索と、物理フォルダー（ファイラー）の両モードを持つ。`.meta.json` を Source of Truth、SQLite を検索キャッシュとする。

設計の基準ドキュメントは [docs/architecture-v2-proposal.md](architecture-v2-proposal.md)（承認済み）と [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。要件は [docs/requirements-v4.md](requirements-v4.md)。

## アーキテクチャ（v2、現行）

旧 Rust/axum サーバーは廃止し `server-rust/` へ退避済み（参照実装）。現行は **TypeScript モノレポ**。

```
mimimilli/                     # pnpm workspace（ルートに統合済み）
├── client/   React 19 + Vite SPA（feature-first: app → features → entities → shared）
├── server/   Hono + Node。routes（薄い） / core（ドメイン） / adapters（real | fixture）
└── shared/   API契約の正典。Zod スキーマ + 型（client / server 双方が依存）
```

- **契約の正典は `shared/`**（Zod）。client は `@mimimilli/shared` から型を import し、server も同じ型でルートを実装する。契約のズレは `tsc` が機械検出する
- **アダプタ境界（ADR-0002）**: ルーター・ドメインロジックは1系統。データの出どころだけ差し替える
  - `fixture` アダプタ: インメモリの開発データ（旧 `client/mocks/` を昇格させたもの）。シナリオ切替（`MIMIMILLI_MOCK_SCENARIO` = default/empty/new-work/errors）と**合成メディア**（無音WAV・SVGカバー、Range対応）を持つ
  - `real` アダプタ: SQLite（Drizzle）+ 実FS + スキャナー + DLsite
- **dev は vite middleware**: `client/vite.config.ts` が `BACKEND_URL` 未指定時、server の Hono アプリ（fixture注入）を dev middleware としてマウント。`pnpm dev` 一発で UI もモックAPIも動く

### ⚠ dev サーバーの落とし穴（重要）

vite middleware は fixture アダプタと Hono アプリを**プラグイン初期化時に1度だけ生成**する。そのため **`server/src` を変更しても起動中の dev サーバーには反映されない**（fixtureもアプリも古いインスタンスのまま）。

- 症状例: 合成メディアを server に足しても、起動中 dev サーバーは cover/audio を 404 のまま返す
- 切り分け: `MIMIMILLI_ADAPTER=fixture PORT=18099 node server/src/index.ts` で別ポート起動して `curl` 確認（こちらは最新コードで応答する）
- 対処: **サーバー側を変えたら dev サーバーを手動再起動**。client 側（`src/`）の変更は HMR で反映されるので影響なし

## 起動・検証コマンド

開発サーバーは別シェルで起動済みのことが多い（`pnpm dev` を勝手に実行しない）。アクセスは `http://mimi.localhost:1355`（IP不可）。`agent-browser` を使うときは必ず `--session <名前>` を付ける（他セッションとブラウザ／タブを共有して奪い合うのを防ぐ）。

```bash
# ルートから（fixture アダプタ同居の通常開発）
pnpm dev            # client 起動。vite middleware が fixture API を /api/* にマウント
pnpm check          # shared + server + client の tsc
pnpm test           # server (node:test) + client (vitest)
pnpm test:server
pnpm test:client
pnpm test:visual         # Playwright 比較
pnpm test:visual:update  # スナップショット再生成
# ビジュアルテストの webServer は MIMIMILLI_MOCK_SCENARIO=new-work で別ポート(4175)に自前で立つ

# fixture シナリオ
pnpm dev:fixture:new-work
pnpm dev:fixture:empty
pnpm dev:fixture:errors

# real アダプタ（実SQLite + 実FS）
pnpm dev:real          # API サーバー + client を並行起動
pnpm dev:real:server   # API サーバーのみ => http://localhost:8080（DB は MIMIMILLI_DB、既定 ./data/mimimilli.db）
pnpm dev:real:client   # client のみ。BACKEND_URL=http://localhost:8080 へ向けて起動
pnpm smoke:real        # 固定のサンプル音声で real 経路を手動スモーク

# fixture サーバーを単体起動して curl 確認（合成メディアの検証等）
MIMIMILLI_ADAPTER=fixture PORT=18099 node server/src/index.ts
```

ビジュアルテストの注意:
- スナップショットは**必ず Playwright で生成**する（agent-browser で撮った画像はレンダリングが違い、CI 比較で落ちる）
- パネル等の**要素単位**で `toHaveScreenshot` する。`fullPage` は半透明オーバーレイ越しの背景差分が `maxDiffPixelRatio` で薄まり**偽パス**になる（scan結果ダイアログで実際に踏んだ。`role=dialog` 要素を撮る形に修正済み）
- 共有 fixture 状態に依存するため直列実行が前提（`playwright.config.ts`: workers:1 / fullyParallel:false / retries:2 / maxDiffPixelRatio 0.03）

## API 契約 v2（現行エンドポイント）

すべて `/api` 配下。リクエスト/レスポンスは `shared/src/*.ts` の Zod スキーマが正典。エラーは `{ error: { code, message } }`（`apiErrorSchema`）。

| メソッド | パス | 備考 |
|---|---|---|
| GET / PUT | `/settings` | |
| POST | `/scan` | |
| GET | `/works` | **ページングエンベロープ `{ items, total }`**（page/limit省略時は全件） |
| GET | `/works/:id` | 完全な Work（playlists・resumePosition・resumeTrackIndex 含む） |
| PATCH | `/works/:id` | `{ title?, tags?, bookmarked? }` を統合（旧 PUT tags/title・POST bookmark を廃止） |
| POST | `/works/:id/resume` | `{ position, trackIndex }`（高頻度のため PATCH と分離） |
| POST | `/works/:id/last-played` | |
| GET | `/works/:id/files` | 物理ファイルツリー |
| GET | `/tags` | フラット/構造化タグの一覧 |
| POST | `/export` | `{ data }`（JSON文字列） |
| GET | `/axes/:axis` | ファセット集計（circle/cv/series/cat/tag/year） |
| GET/POST | `/smart-folders` | |
| PUT/DELETE | `/smart-folders/:id` | |
| GET | `/smart-folders/:id/works` | スマートフォルダー評価結果 |
| GET/POST | `/presets`、DELETE `/presets/:id` | 検索プリセット |
| GET | `/fs` | 物理FSブラウズ（Filesモード） |
| GET | `/media/cover/:id`、`/media/audio/:id/:path`、`/media/file/:id/:path` | audio は Range(206) 対応 |
| POST | `/dlsite/:id/fetch`、`/dlsite/:id/apply` | |

メディアURLは client の `entities/work/api.ts` の `getCoverImageUrl`/`getAudioUrl`/`getFileUrl` が組み立てる（`<img src>`/`<audio src>` に直接使える）。

### タグの構造（編集時に注意）

`work.tags` には2種が混在する:
- 構造化タグ（プレフィックス付き）: `cv/水瀬なずな`、`サークル/月白製作所`、`シリーズ/...`、`カテゴリ/...` — 分類軸／ファセットの素
- フラットタグ: `ASMR`、`癒し系` 等の自由タグ

種別判定は `entities/work/model.ts` の `parseTag`。編集UIは構造化タグを保護し、フラットタグのみ追加/削除する（合成ロジックは `entities/work/editableTags.ts`、`buildWorkPatchTags`）。PATCH の tags は**全置換**なので保存時に『構造化タグ＋編集後フラット』を合成して送る。

## クライアントの状態管理

- **Jotai atom**: API由来でない UI 操作状態。library（`features/library/model/atoms.ts`: activeAxis/drillValue/selectedTags/selectedWorkId/sort）、files（`features/files/model/atoms.ts`: relPath/selectedPath/direction）、player（後述）
- **TanStack Query**: サーバー状態。キーは `LibraryView.tsx` の `LIBRARY_KEYS` で一元管理（works/libraryTotal/facets/smartFolders/smartFolderWorks/workDetail/tags と、広域 invalidate 用の allWorks/allFacets/allSmartFolderWorks プレフィックスキー）
- **URL同期**: `features/navigation/`（`navigationUrl.ts` codec + `useNavigationHistory.ts` の history 同期層）。モード・軸・ドリル・タグ・選択作品・ソート・ファイルパスを URL に双方向同期。ナビ操作は `push`、選択/ソート等の軽微変更は `replace`。`requestNavigationHistoryCommitAtom` を各操作（useLibraryNavigation / useFilesNavigation / LeftNav の setMode）が叩いて push/replace を宣言する。AddressBar の戻る/進む・パンくずも本物

## プレイヤーのアーキテクチャ

`client/src/features/player/`。UIは「画面下バー + 右下ポップアップ + 全画面」の3層構成（バー⇄ポップアップは `PlayerDock.tsx` が AnimatePresence で切替）。

- `model/atoms.ts`:
  - `playerCoreAtom`（低頻度 state: isPlaying / currentWork / tracks / currentTrackIndex / volume / loop / showFullPlayer / **playbackRate / channelSwap / abRepeat**）
  - `playerCurrentTimeAtom` / `playerDurationAtom`（**高頻度**。timeupdate 毎に更新。**TransportBar と FullScreenPlayer だけが subscribe**する。App.tsx は subscribe しないので再生中に App が再レンダリングされない — この分離は**維持必須**）
- `model/audioEngine.ts`: 低レベル。`new Audio()`（DOM外）。load/play/pause/seek/seekRelative/setVolume/setPlaybackRate/setChannelSwap、timeupdate/durationchange/ended コールバック
- `model/usePlayer.ts`: エンジンと atom の橋渡し。公開アクション:
  - 配線済み: `play` / `togglePlay` / `seek` / `seekRelative` / `setVolume` / `setLoop` / `nextTrack` / `prevTrack` / `setTrackIndex` / `setShowFullPlayer` / `playWithResume` / `setPlaybackRate`（ポップアップの倍速メニュー）
  - **実装済みだが UI 未配線**: `setChannelSwap`（L⇄R入替）、`setABPoint`/`clearABRepeat`（A-Bリピート）。state にも `channelSwap`/`abRepeat` がある
- `ui/PlayerDock.tsx`: バー⇄ポップアップの外枠・層切替
- `ui/BarContent.tsx`（画面下バー）: カバー / トラック名 / クリック可能なシーク行（経過・総時間） / 再生切替。バークリックでポップアップへ
- `ui/PopupContent.tsx`（右下ポップアップ）: 大カバー / シーク / 前・次・ループ / ±10秒 / 倍速 / 音量 / 再生中の作品へジャンプ / 全画面展開
- `ui/FullScreenPlayer.tsx`: 全画面。トラックリスト・シーク・音量・ループ。Esc で閉じる（Tailwind移行済み）
- `ui/useSeekDrag.ts`: シーク操作の共通フック（バー・ポップアップ・全画面で共用）

### プレイヤーの残課題

- L⇄R入替・A-Bリピートの UI が無い（エンジンは実装済み、配線するだけ）
- 全画面プレイヤーのフォーカストラップ無し
- バーへの前/次トラックボタン追加は判断保留（ポップアップで完結しているため）

### ⚠ 自動検証の限界（音声）

headless Chromium（agent-browser / Playwright）は fixture の合成 8bit WAV の**メタデータをデコードしない**。そのため自動環境では duration/currentTime が 0:00 のままで、**シークバーが実時間で動く様子・続きから再生の位置seek は自動では確認できない**（通常再生も同様＝resume固有ではない）。トラック選択・UI状態までは確認可能。**実時間の再生／シークの手触りは実ブラウザ（Chrome で `mimi.localhost:1355`）で人が確認する**必要がある。

## 直近の成果（2026-06-13〜06-20）

レビュー issue [docs/issues/2026-06-12-mock-ui-ux-and-architecture-review.md](issues/2026-06-12-mock-ui-ux-and-architecture-review.md) への対応を中心とした主な変更:

- 契約統合（ADR-0002完了）: client/mocks 廃止 → fixture アダプタへ吸収、型を shared へ、API を v2 へ全面切替、vite middleware 化。fixture シナリオ移植と合成メディア（無音WAV/SVGカバー/Range）
- 欠損・エラー作品の状態表示＋再生無効化、サイレント失敗（`catch{}`）解消
- URL同期とナビ履歴（戻る/進む・パンくず・リロード復元）、並び替えメニュー実働化、タグ絞り込み結果からの作品導線
- レジューム再生（続きから再生）、ブックマーク切替・タイトル/タグ編集UI
- ファイルモードの RJ コード二重表示修正（`workFolderDisplay`）と絞り込み結果時の案内文修正（`axisLandingPresentation`）、ビジュアルテスト基盤の安定化（75bfb35）
- real アダプタ接続用の `dev:real` スクリプト追加、Windows 向け cross-env 修正（8260a44 / 70ee2fc）

各タスクの詳細は `docs/issues/2026-06-13-*.md`（url-navigation-history / resume-playback / work-metadata-editing）。

## 直近の成果（2026-07-03: UI操作系の全面改善）

[docs/issues/2026-07-03-frontend-ui-improvement-proposal.md](issues/2026-07-03-frontend-ui-improvement-proposal.md)（提案+実施記録）参照。要点:

- `shared/ui/` に `Button` / `IconButton` / `TagCombobox` を新設し、CSSクラス直付けボタンを置換（LeftNav と円形トランスポートは固有意匠のため据え置き）
- タグ編集を直編集化（チップ×即削除+「+」ポップオーバー即追加、datalist廃止）、タイトル編集は `⋯` メニュー→ポップオーバー化
- 再生バーにクリック可能なシーク行を追加、バーが下のコンテンツのクリックを奪うバグを修正、FullScreenPlayer を Tailwind 移行
- `shell.css` の `.mle-app button` リセットを `@layer base` 化（レイヤー外CSSがTailwindユーティリティに常勝していた統合バグの修正。**今後 shell.css に素の button セレクタを追加するときは注意**）
- ビジュアルテストのスペック更新+スナップショット再生成済み

### 残タスク

1. 飾り/未実装のコントロール: 通知ベル（`TopBar.tsx` にハンドラ無し）、スマートフォルダー条件エディタ（新規作成は `window.prompt` で名前のみ・`rules: []` 固定。「条件を追加」は disabled+「近日実装」表示に変更済み）、AddressBar のビュー切替リスト/グリッド・左ナビの再生中/履歴/お気に入り/ピン留め（いずれも disabled+「近日実装」表示に変更済み、機能は未実装）
2. プレイヤー: L⇄R入替・A-Bリピートの UI 配線、フォーカストラップ（上記「プレイヤーの残課題」）
3. 任意の磨き残し: `shell.css` の未参照クラス整理（`.mll-rtrk` 等の orphaned CSS、置換で未参照になった `.mle-icbtn` 系）、LeftNav のラベル付与検討、ダークテーマ（`.ml-dark`）での新コンポーネント確認

## 開発上のルール（AGENTS.md より）

- コミットは日本語・Conventional Commits。`git -C` 禁止。コミットはユーザー指示があるまでしない（監督がレビュー後にまとめる）
- 過度なフォールバック禁止・エラー隠蔽禁止。互換性より適切な設計（破壊的変更OK）。場当たり的修正禁止
- フロントの見た目は mimimilli 正典 [docs/design_handoff_mimimilli_library/README.md](design_handoff_mimimilli_library/README.md) に従う（カラートークン・`mle-`/`mll-` クラス体系・motion 等）。トークンは `client/src/styles/`
- WSL 環境。Windows パスは WSL パスへ変換。jq でJSON処理、rg 推奨

## ⚠ まだ更新されていないドキュメント

以下は旧 Rust/axum 時代の名残:

- `docs/requirements-v4.md` — **要件（機能）は有効**だが技術スタック記述が Rust 前提（冒頭バナーで読み替えを明記済み）
- `docs/web-architecture-proposal.md` — architecture-v2 に置き換え済み（設計経緯の記録として意図的に保持。冒頭にバナーあり）
- `server-rust/` — 退避した旧実装（参照用、ビルド対象外）

`README.md` は 2026-06-21 に全面メンテ済み（プロジェクト構造図の `server/`=axum(Rust) 表記を Hono+Node へ修正、廃止済みの `client/mocks/` を削除、real 接続コマンドを `pnpm dev:real` に修正、Filesモードを特徴へ追記）。`docs/DEVELOPMENT.md` は内容が全面的に旧 Rust 前提かつ本 HANDOFF と重複していたため削除した（開発ワークフローは本書がカバーする）。

現行の正は本 HANDOFF と [docs/architecture-v2-proposal.md](architecture-v2-proposal.md)、`shared/src/`（契約）、`server/src/`（実装）。

## 実装を委譲する場合

実装・調査・デバッグは Codex（`codex exec --json -s workspace-write`、thread_id を控えて resume で反復）か Sonnet サブエージェントに委譲し、**監督側が差分レビュー・テスト・実機確認してからコミット**する運用。Codex のサンドボックスは Playwright（Chromium 起動・vite listen）が EPERM で動かないことがあるので、**スナップショット生成は監督側の環境で行う**。
