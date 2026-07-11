# 引き継ぎドキュメント

mimimilli の現状と進行中の作業を、後続のエージェント／セッションが把握するための資料。
最終更新: 2026-07-10。

## このアプリは何か

DLsite/FANZA 等からダウンロードした音声作品（ASMR・ボイスドラマ等）をローカルで管理・再生する常駐 Web アプリ。タグ／分類軸ベースの検索と、物理フォルダー（ファイラー）の両モードを持つ。`.meta.json` を Source of Truth、SQLite を検索キャッシュとする。

アーキテクチャは [docs/ARCHITECTURE.md](ARCHITECTURE.md)、決定の経緯は [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。要件は [docs/requirements-v4.md](requirements-v4.md)。ドキュメント全体の地図は [docs/README.md](README.md)、未完了タスクは Backlog.md CLI（`pnpm backlog task list --plain`）。

## アーキテクチャ

構造・境界・データフローは [docs/ARCHITECTURE.md](ARCHITECTURE.md) を参照。

- fixture アダプタはシナリオ切替（`MIMIMILLI_MOCK_SCENARIO` = default/empty/new-work/errors）と**合成メディア**（無音WAV・SVGカバー、Range対応）を持つ
- dev は vite middleware: `client/vite.config.ts` が `BACKEND_URL` 未指定時、server の Hono アプリ（fixture注入）を dev middleware としてマウントし、`pnpm dev` 一発で UI もモックAPIも動く

### dev サーバーへの server/src 自動反映

fixture API は `ssrLoadModule` 経由の遅延読み込みで、`server/src`・`shared/src` の変更は watcher がモジュールグラフを無効化し**次の `/api` リクエストで自動反映される**（手動再起動は不要）。client 側（`src/`）は通常の HMR。仕組みの詳細は `client/vite.config.ts` の `fixtureApiPlugin` を参照。

### ⚠ CSS レイヤーの罠

`shell.css` の `.mle-app button` リセットは `@layer base` 内にある。レイヤー外に素の button セレクタを書くと Tailwind ユーティリティに常勝してしまう（実際に統合バグになった）。shell.css にセレクタを足すときはレイヤーを意識すること。

## 起動・検証コマンド

開発サーバーは別シェルで起動済みのことが多い（`pnpm dev` を勝手に実行しない）。アクセスは `http://mimi.localhost:1355`（IP不可）。`agent-browser` を使うときは必ず `--session <名前>` を付ける（他セッションとブラウザ／タブを共有して奪い合うのを防ぐ）。

```bash
# ルートから（fixture アダプタ同居の通常開発）
pnpm dev            # client 起動。vite middleware が fixture API を /api/* にマウント
pnpm check          # shared/server/client の tsc + oxlint + oxfmt --check（これが通れば typecheck/lint/fmt の DoD を満たす）
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
- パネル等の**要素単位**で `toHaveScreenshot` する。`fullPage` は半透明オーバーレイ越しの背景差分が許容差分に薄まり**偽パス**になる（scan結果ダイアログで実際に踏んだ。`role=dialog` 要素を撮る形に修正済み）
- 共有 fixture 状態に依存するため直列実行が前提（`playwright.config.ts`: workers:1 / fullyParallel:false / retries:2 / maxDiffPixels:1200。比率指定はレイアウト回帰を素通りさせた実績があり使わない）

## API 契約 v2（現行エンドポイント）

すべて `/api` 配下。リクエスト/レスポンスは `shared/src/*.ts` の Zod スキーマが正典。エラーは `{ error: { code, message } }`（`apiErrorSchema`）。**下表はあくまで概観で、エンドポイントを追加・変更したときに更新漏れしうる。実装時は必ず `shared/src/` を直接確認すること。**

| メソッド     | パス                                                                  | 備考                                                                                                                      |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET / PUT    | `/settings`                                                           |                                                                                                                           |
| POST         | `/scan`                                                               | 同期実行（完了までブロックし ScanResult を返す）。実行中の二重POSTは409                                                   |
| GET          | `/scan/events`                                                        | スキャン進捗のSSE（progress/complete/error。再接続挙動は routes/scan.ts 冒頭）                                            |
| GET          | `/works`                                                              | **ページングエンベロープ `{ items, total }`**（page/limit省略時は全件）                                                   |
| GET          | `/works/:id`                                                          | 完全な Work（playlists・resumePosition・resumeTrackIndex 含む）                                                           |
| PATCH        | `/works/:id`                                                          | `{ title?, tags?, bookmarked? }` を統合（旧 PUT tags/title・POST bookmark を廃止）                                        |
| POST         | `/works/:id/resume`                                                   | `{ position, trackIndex }`（高頻度のため PATCH と分離）                                                                   |
| POST         | `/works/:id/last-played`                                              |                                                                                                                           |
| GET          | `/works/:id/files`                                                    | 物理ファイルツリー                                                                                                        |
| GET          | `/tags`                                                               | フラット/構造化タグの一覧                                                                                                 |
| GET/POST     | `/tag-prefixes`                                                       | prefix定義の一覧・追加                                                                                                    |
| PATCH/DELETE | `/tag-prefixes/:prefix`                                               | prefix定義の変更・削除                                                                                                    |
| GET          | `/tag-prefixes/candidates`                                            | データ中に存在する未登録prefixの候補                                                                                      |
| POST         | `/export`                                                             | `{ data }`（JSON文字列）                                                                                                  |
| GET          | `/axes/:axis`                                                         | prefix定義から動的生成した軸と、組み込みのタグ・追加日軸のファセット集計                                                  |
| GET/POST     | `/smart-folders`                                                      |                                                                                                                           |
| PUT/DELETE   | `/smart-folders/:id`                                                  |                                                                                                                           |
| GET          | `/smart-folders/:id/works`                                            | スマートフォルダー評価結果                                                                                                |
| GET/POST     | `/presets`、DELETE `/presets/:id`                                     | 検索プリセット                                                                                                            |
| GET          | `/fs`                                                                 | 物理FSブラウズ（Filesモード）                                                                                             |
| GET          | `/media/cover/:id`、`/media/audio/:id/:path`、`/media/file/:id/:path` | audio は Range(206) 対応。cover は `?w=128\|256\|512` でサムネイル（realはwebp化+ディスクキャッシュ、fixtureのSVGは原寸） |
| POST         | `/dlsite/:id/fetch`、`/dlsite/:id/apply`                              |                                                                                                                           |

メディアURLは client の `entities/work/api.ts` の `getCoverImageUrl`/`getAudioUrl`/`getFileUrl` が組み立てる（`<img src>`/`<audio src>` に直接使える）。

### タグの構造（編集時に注意）

`work.tags` には2種が混在する:

- Annotatedタグ（prefix付き）: `cv/水瀬なずな`、`サークル/月白製作所`、`シリーズ/...`、`カテゴリ/...`。軸表示がONのprefixは分類軸／ファセットの素になる
- フラットタグ: `ASMR`、`癒し系` 等の自由タグ

編集UIでは両方のタグを追加・削除できる。prefix定義で保護されたタグを削除するときだけ確認ダイアログを表示し、確認後は削除できる。prefix定義は軸表示・保護・ラベル・色を持つユーザー編集可能な設定データであり、特定prefixをコードで分岐しない。

タグは `shared/src/work.ts` の `normalizeTag` で正規化する。Annotatedタグはprefixをtrimして小文字化し、値をtrimする。フラットタグは全体をtrimする。`shared/src/api.ts` の `workPatchSchema` がPATCH契約の入口で正規化を適用する。

クライアントの追加・削除ロジックは `entities/work/editableTags.ts` の `buildTagsWithAdded` / `buildTagsWithRemoved`、編集フローと保護確認は `features/library/ui/preview/useWorkTagEditor.ts` を参照する。PATCHの `tags` は全置換なので、変更後の全タグを送る。

## クライアントの状態管理

- **Jotai atom**: API由来でない UI 操作状態。library（`features/library/model/atoms.ts`: activeAxis/drillValue/selectedTags/selectedWorkId/sort）、files（`features/files/model/atoms.ts`: relPath/selectedPath/direction）、player（後述）
- **TanStack Query**: サーバー状態。キーは `LibraryView.tsx` の `LIBRARY_KEYS` で一元管理（works/libraryTotal/facets/smartFolders/smartFolderWorks/workDetail/tags と、広域 invalidate 用の allWorks/allFacets/allSmartFolderWorks プレフィックスキー）
- **URL同期**: `features/navigation/`（`navigationUrl.ts` codec + `useNavigationHistory.ts` の history 同期層）。モード・軸・ドリル・タグ・選択作品・ソート・ファイルパスを URL に双方向同期。ナビ操作は `push`、選択/ソート等の軽微変更は `replace`。`requestNavigationHistoryCommitAtom` を各操作（useLibraryNavigation / useFilesNavigation / LeftNav の setMode）が叩いて push/replace を宣言する。AddressBar の戻る/進む・パンくずも本物
- **共通UIコンポーネント**: `client/src/shared/ui/` の `Button` / `IconButton` / `TagCombobox` を使う（CSSクラス直付けボタンは廃止済み。LeftNav と円形トランスポートだけ固有意匠のため例外）

## プレイヤーのアーキテクチャ

`client/src/features/player/`。UIは「画面下バー + 右下ポップアップ + 全画面」の3層構成（バー⇄ポップアップは `PlayerDock.tsx` が AnimatePresence で切替）。

- `model/atoms.ts`:
  - `playerCoreAtom`（低頻度 state: isPlaying / currentWork / tracks / currentTrackIndex / volume / loop / showFullPlayer / **playbackRate / channelSwap / abRepeat**）
  - `playerCurrentTimeAtom` / `playerDurationAtom`（**高頻度**。timeupdate 毎に更新。**TransportBar と FullScreenPlayer だけが subscribe**する。App.tsx は subscribe しないので再生中に App が再レンダリングされない — この分離は**維持必須**）
- `model/audioEngine.ts`: 低レベル。`new Audio()`（DOM外）。load/play/pause/seek/seekRelative/setVolume/setPlaybackRate/setChannelSwap、timeupdate/durationchange/ended コールバック
- `model/usePlayer.ts`: エンジンと atom の橋渡し。公開アクション:
  - 配線済み: `play` / `togglePlay` / `seek` / `seekRelative` / `setVolume` / `setLoop` / `nextTrack` / `prevTrack` / `setTrackIndex` / `setShowFullPlayer` / `playWithResume` / `setPlaybackRate`（ポップアップの倍速メニュー）
  - `setChannelSwap`（L⇄R入替）、`setABPoint`/`clearABRepeat`（A-Bリピート）: 全画面プレイヤーに配線済み。A-B は a < b のときだけ成立（B→A の順で設定すると自動で入れ替え）
- `ui/PlayerDock.tsx`: バー⇄ポップアップの外枠・層切替
- `ui/BarContent.tsx`（画面下バー）: カバー / トラック名 / 再生切替 + バー下辺に貼り付くシークバー（時間表示なし）。バークリックでポップアップへ
- `ui/PopupContent.tsx`（右下ポップアップ）: 大カバー / シーク / 前・次・ループ / ±10秒 / 倍速 / 音量 / 再生中の作品へジャンプ / 全画面展開
- `ui/FullScreenPlayer.tsx`: 全画面。トラックリスト・シーク・音量・ループ。ネイティブ `<dialog>` + `showModal()` の完全モーダル（フォーカストラップ・Esc はブラウザ標準に委譲）
- `ui/useSeekDrag.ts`: シーク操作の共通フック（バー・ポップアップ・全画面で共用）

### プレイヤーの残課題

backlog の `player` ラベルのタスクを参照（`pnpm backlog task list --labels player --plain`。L⇄R・A-Bリピートの UI 配線等）。

### ⚠ 自動検証の限界（音声）

headless Chromium（agent-browser / Playwright）は fixture の合成 8bit WAV の**メタデータをデコードしない**。そのため自動環境では duration/currentTime が 0:00 のままで、**シークバーが実時間で動く様子・続きから再生の位置seek は自動では確認できない**（通常再生も同様＝resume固有ではない）。トラック選択・UI状態までは確認可能。**実時間の再生／シークの手触りは実ブラウザ（Chrome で `mimi.localhost:1355`）で人が確認する**必要がある。

## 開発上のルール（AGENTS.md より）

- コミットは日本語・Conventional Commits。`git -C` 禁止。コミットはユーザー指示があるまでしない（監督がレビュー後にまとめる）
- 過度なフォールバック禁止・エラー隠蔽禁止。互換性より適切な設計（破壊的変更OK）。場当たり的修正禁止
- フロントの見た目は [docs/design-system.md](design-system.md) の規約に従う（カラートークン・`mle-`/`mll-` クラス体系・motion 等）。トークンの正は `client/src/styles/tokens.css`
- WSL 環境。Windows パスは WSL パスへ変換。jq でJSON処理、rg 推奨

## ドキュメントの現状

ドキュメントの地図（現行の正典・規約・削除済みの区分）は [docs/README.md](README.md) が正。2026-07-03 の棚卸しで、旧 Rust 時代の名残は解消済み: `requirements-v4.md` の技術記述を現行（Hono + TS）へ更新、`web-architecture-proposal.md` と `design-brief.md` は削除（Git 履歴に残る）。旧 Rust 実装 `server-rust/` も TS 版への移植完了を確認して削除済み（Git 履歴に残る）。

現行の正は本 HANDOFF と [docs/ARCHITECTURE.md](ARCHITECTURE.md)、`shared/src/`（契約）、`server/src/`（実装）。

本書は「現在の状態」だけを記述する方針で、時系列の経緯（いつ何をやったか）は [docs/issues/](issues/README.md) と Git 履歴が持つ。

## 実装を委譲する場合

実装・調査・デバッグは Codex（`codex exec --json -s workspace-write`、thread_id を控えて resume で反復）か Sonnet サブエージェントに委譲し、**監督側が差分レビュー・テスト・実機確認してからコミット**する運用。Codex のサンドボックスは Playwright（Chromium 起動・vite listen）が EPERM で動かないことがあるので、**スナップショット生成は監督側の環境で行う**。
