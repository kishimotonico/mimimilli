# 引き継ぎドキュメント

mimikago の現状と進行中の作業を、後続のエージェント／セッションが把握するための資料。
最終更新: 2026-06-21。

## このアプリは何か

DLsite/FANZA 等からダウンロードした音声作品（ASMR・ボイスドラマ等）をローカルで管理・再生する常駐 Web アプリ。タグ／分類軸ベースの検索と、物理フォルダー（ファイラー）の両モードを持つ。`.meta.json` を Source of Truth、SQLite を検索キャッシュとする。

設計の基準ドキュメントは [docs/architecture-v2-proposal.md](architecture-v2-proposal.md)（承認済み）と [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。要件は [docs/requirements-v4.md](requirements-v4.md)。

## アーキテクチャ（v2、現行）

旧 Rust/axum サーバーは廃止し `server-rust/` へ退避済み（参照実装）。現行は **TypeScript モノレポ**。

```
mimikago/                      # pnpm workspace（ルートに統合済み）
├── client/   React 19 + Vite SPA（feature-first: app → features → entities → shared）
├── server/   Hono + Node。routes（薄い） / core（ドメイン） / adapters（real | fixture）
└── shared/   API契約の正典。Zod スキーマ + 型（client / server 双方が依存）
```

- **契約の正典は `shared/`**（Zod）。client は `@mimikago/shared` から型を import し、server も同じ型でルートを実装する。契約のズレは `tsc` が機械検出する
- **アダプタ境界（ADR-0002）**: ルーター・ドメインロジックは1系統。データの出どころだけ差し替える
  - `fixture` アダプタ: インメモリの開発データ（旧 `client/mocks/` を昇格させたもの）。シナリオ切替（`MIMIKAGO_MOCK_SCENARIO` = default/empty/new-work/errors）と**合成メディア**（無音WAV・SVGカバー、Range対応）を持つ
  - `real` アダプタ: SQLite（Drizzle）+ 実FS + スキャナー + DLsite
- **dev は vite middleware**: `client/vite.config.ts` が `BACKEND_URL` 未指定時、server の Hono アプリ（fixture注入）を dev middleware としてマウント。`pnpm dev` 一発で UI もモックAPIも動く

### ⚠ dev サーバーの落とし穴（重要）

vite middleware は fixture アダプタと Hono アプリを**プラグイン初期化時に1度だけ生成**する。そのため **`server/src` を変更しても起動中の dev サーバーには反映されない**（fixtureもアプリも古いインスタンスのまま）。

- 症状例: 合成メディアを server に足しても、起動中 dev サーバーは cover/audio を 404 のまま返す
- 切り分け: `MIMIKAGO_ADAPTER=fixture PORT=18099 node server/src/index.ts` で別ポート起動して `curl` 確認（こちらは最新コードで応答する）
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
# ビジュアルテストの webServer は MIMIKAGO_MOCK_SCENARIO=new-work で別ポート(4175)に自前で立つ

# real アダプタ（実SQLite + 実FS）で動かす場合は2プロセス
pnpm dev:server     # API サーバーを real アダプタで起動 => http://localhost:8080（DB は MIMIKAGO_DB、既定 ./data/mimikago.db）
pnpm dev:real       # client を BACKEND_URL=http://localhost:8080 へ向けて起動

# fixture サーバーを単体起動して curl 確認（合成メディアの検証等）
MIMIKAGO_ADAPTER=fixture PORT=18099 node server/src/index.ts
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

## プレイヤーのアーキテクチャ（次のUI刷新で触る中心）

`client/src/features/player/`。

- `model/atoms.ts`:
  - `playerCoreAtom`（低頻度 state: isPlaying / currentWork / tracks / currentTrackIndex / volume / loop / showFullPlayer / **playbackRate / channelSwap / abRepeat**）
  - `playerCurrentTimeAtom` / `playerDurationAtom`（**高頻度**。timeupdate 毎に更新。**TransportBar と FullScreenPlayer だけが subscribe**する。App.tsx は subscribe しないので再生中に App が再レンダリングされない — この分離は**維持必須**）
- `model/audioEngine.ts`: 低レベル。`new Audio()`（DOM外）。load/play/pause/seek/seekRelative/setVolume/setPlaybackRate/setChannelSwap、timeupdate/durationchange/ended コールバック
- `model/usePlayer.ts`: エンジンと atom の橋渡し。公開アクション:
  - 配線済み: `play` / `togglePlay` / `seek` / `seekRelative` / `setVolume` / `setLoop` / `nextTrack` / `prevTrack` / `setTrackIndex` / `setShowFullPlayer`
  - **実装済みだが UI 未配線**: `playWithResume`（→「続きから再生」で配線済み）、`setPlaybackRate`（倍速）、`setChannelSwap`（L⇄R入替）、`setABPoint`/`clearABRepeat`（A-Bリピート）。state にも `playbackRate`/`channelSwap`/`abRepeat` がある
- `ui/TransportBar.tsx`（常駐バー）: now playing / 前・再生・次 / シークバー / ループ・音量・**「重ねて再生」(disabled飾り)**・-10/+10・全画面展開ボタン
- `ui/FullScreenPlayer.tsx`: 全画面。トラックリスト・シーク・音量・ループ。Esc で閉じる

### プレイヤー UI 刷新で対応したい既知の課題（レビュー issue 由来）

- TransportBar 右端のレイアウト崩れ: 「重ねて再生」ボタンが音量スライダーに重なる、全画面展開ボタンが画面隅すぎる（dev では TanStack Devtools のボタンに覆われる）
- 倍速・A-Bリピート・L⇄R入替の UI が無い（エンジンは実装済み、配線するだけ）
- 全画面プレイヤーのアイコンボタンに aria-label が無い、フォーカストラップ無し
- フローティング/ポップアップモード（要件 Phase3、お兄ちゃんが検討中）
- TransportBar now playing のハートが飾り（詳細パネルのブックマークは実働化済み。同じ `patchWork({bookmarked})` で配線できる）

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

### 残タスク（レビュー issue §残 と対応）

1. **プレイヤー UI 刷新**（未着手。上記「課題」＋シークバー/ボタン/ポップアップモード）
2. 飾りのままのコントロール: 通知ベル（`TopBar.tsx` にハンドラ無し）、スマートフォルダー条件エディタ（`LibraryView.tsx` の新規作成は `window.prompt` で名前のみ取得・`rules: []` 固定）、AddressBar のビュー切替（リスト/グリッド）と「その他」ボタン（UI/props はあるが `App.tsx` が配線していない配線漏れ）。戻る/進む・パンくず・並び替えは配線済み

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
