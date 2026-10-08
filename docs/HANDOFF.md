# 引き継ぎドキュメント

mimimilli の現状と進行中の作業を、後続のエージェント／セッションが把握するための資料。

## このアプリは何か

DLsite/FANZA 等からダウンロードした音声作品（ASMR・ボイスドラマ等）をローカルで管理・再生する常駐 Web アプリ。タグ／分類軸ベースの検索と、物理フォルダー（ファイラー）の両モードを持つ。`mimimilli.json` を Source of Truth、SQLite を検索キャッシュとする。

名前は3つ使い分けている。アプリ・パッケージ名は `mimimilli`、リポジトリ／ディレクトリ名は旧名の `mimikago` のまま、portless のサービス名は短い URL を保つため `mimi`。いずれも意図的なので揃えようとしないこと。

アーキテクチャは [docs/ARCHITECTURE.md](ARCHITECTURE.md)、決定の経緯は [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。要件は [docs/requirements-v4.md](requirements-v4.md)。ドキュメント全体の地図は [docs/README.md](README.md)、未完了タスクは Backlog.md CLI（`pnpm backlog task list --plain`）。

## アーキテクチャ

構造・境界・データフロー（Vite proxy / portless の開発時トポロジー含む）は [docs/ARCHITECTURE.md](ARCHITECTURE.md) を参照。HANDOFF 固有の補足:

- fixture アダプタはシナリオ切替（`MIMIMILLI_MOCK_SCENARIO` = default/empty/new-work/identity-conflict/errors/large/scan-review/root-reconfiguration-failed）と**合成メディア**（無音WAV・SVGカバー、Range対応）を持つ。`large` は手書きシード11件 + 決定的生成989件の計1000件で、実ライブラリ規模の見え方を確認する用途

### dev サーバーへの server/src 自動反映

fixture API は Bun サーバー（`bun --watch`）で動く。`server/src`・`shared/src` の変更は watcher による再起動で**次の `/api` リクエストに反映される**。client 側（`src/`）は Vite の HMR。`shared/src` に新しい export を追加すると画面が白くなることがあり、その場合は dev サーバーの再起動が要る。

### CSS レイヤー

`client/src/styles/shell/` 配下 CSS にセレクタを足すときは必ずカスケードレイヤー内に置くこと（レイヤー外の素のセレクタは Tailwind ユーティリティを潰す）。仕組みと規約は [design-system.md](design-system.md) の「クラス命名」節が正。

## 起動・検証コマンド

起動・デバッグの約束事（`pnpm dev` を勝手に実行しない、アクセスは `http://mimi.localhost:1355`、agent-browser は `--session` 必須など）は [AGENTS.md](../AGENTS.md) が正。ここではコマンド一覧だけを持つ。

```bash
# ルートから（fixture 開発）
pnpm dev            # Vite + Bun fixture サーバーを並列起動（large シナリオ=1000件）
pnpm check          # shared/server/client の tsc + oxlint + oxfmt --check（これが通れば typecheck/lint/fmt の DoD を満たす）
pnpm test           # server (Bunランナー + node:test API) + client (vitest)
pnpm test:server
# server テストは bunfig.toml [test].preload で per-test タイムアウト 30s（ハング検出。Bun既定5sは並列負荷で偽陽性になる）
pnpm test:client
pnpm test:smoke          # Playwright スモークテスト（roleベースの動作確認）
# smokeテストは worker ごとに MIMIMILLI_MOCK_SCENARIO=new-work（spec で test.use({ fixtureScenario }) すると変更可）の Bun + Vite サーバーペアを自前で立てる。
# ポートは起動時にOSから空きを確保する（Bunは PORT=0 で bind して起動ログから読み、Vite は借りた空きポートを渡す）。常駐 dev server や他 worktree の smoke と衝突しない

# fixture シナリオ
pnpm dev:fixture           # 手書きシードの11件のみ
pnpm dev:fixture:new-work
pnpm dev:fixture:identity-conflict   # 単一ファイル形式のID重複
pnpm dev:fixture:empty
pnpm dev:fixture:errors
pnpm dev:fixture:scan-review

# real アダプタ（実SQLite + 実FS）
pnpm dev:real          # API サーバー + client を並行起動
pnpm dev:real:server   # API サーバーのみ => http://api.mimi.localhost:1355（Bun。データルートはMIMIMILLI_DATA_DIRで上書き可）
pnpm dev:real:client   # client のみ。同じworktreeのapi.mimiへ向けて起動
pnpm smoke:real        # 固定のサンプル音声で real 経路を手動スモーク

# dev:real:server は scripts/dev-real.mjs 経由で起動する。git worktree add で作った
# linked worktree から起動した場合は、本番データディレクトリを共有しないよう
# MIMIMILLI_DATA_DIR を自動で <本番データルートの親>/mimimilli-worktrees/<basename>-<絶対パスsha256先頭8桁> に設定する
# （例: task-222-88693cac。起動ログの "[dev-real] ..." 行でどのディレクトリが使われたか確認できる）。
# メインの作業ディレクトリでは本番データディレクトリを使う。
# worktreeから本番データを明示的に使いたい場合は MIMIMILLI_DATA_DIR を自分で指定する（最優先される）。

# fixture サーバーを単体起動して curl 確認（合成メディアの検証等）
MIMIMILLI_ADAPTER=fixture PORT=18099 pnpm --filter @mimimilli/server start
```

unit テストの約束:

- client は API を fetch 境界でモックする（`client/tests/helpers/api.ts` の `mockApi`）。応答は shared のスキーマを parse する `client/tests/helpers/builders.ts` で作る。`entities/*/api` などのモジュールを `vi.mock` で差し替えない。未モックの fetch はテストを失敗させる（`client/tests/unit/setup.ts`）
- server の HTTP の振る舞いは、`server/tests/helpers/contractHarness.ts` の `defineContract` で fixture と real の両 adapter に同じ期待値を通す。adapter の戻り値を差し替えないと作れない状況だけ fixture ベースのスタブで書く

smokeテストの注意:

- 最終確認は目視で行う方針のため、スクリーンショット比較は行わない。smoke が赤いときは常に実際の不具合を意味する（見た目のズレでは落ちない設計）
- 並列度は `client/tests/smoke/workerCount.ts` の `SMOKE_WORKERS` が正。fixture の可変状態は worker ごとのサーバーペアに分離され、テストごとにリセットされる。リトライはしない（`playwright.config.ts` の `retries: 0`。リトライで不具合を隠さない）
- Codex のサンドボックスは Playwright（Chromium 起動・vite listen）が EPERM で動かないことがあるので、Codex に実装を委譲した場合も smoke の実行は別の環境で行う

## API 契約

すべて `/api` 配下。リクエスト/レスポンスの正典は `shared/src/*.ts` の Zod スキーマ、エンドポイントの一覧は `server/src/routes/` のルートファイル。エラーは `{ error: { code, message } }`（`apiErrorSchema`）。

| ルートファイル           | 担当                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `settings.ts`            | 設定の取得                                                                                    |
| `rootReconfiguration.ts` | ルートフォルダーの再設定ワークフロー（[ADR-0029](adr/0029-root-reconfiguration-workflow.md)） |
| `scan.ts`                | スキャンジョブ（開始・取得・キャンセル・SSE）、候補プール・除外・登録、診断                   |
| `works.ts`               | 作品の一覧・登録・正本編集・タグ編集・しおり・再生準備・resume・登録解除、`/tags`、`/export`  |
| `dlsite.ts`              | DLsite の取得・適用・一括取得ジョブ（SSE）・通知（[dlsite.md](dlsite.md)）                    |
| `tagPrefixes.ts`         | prefix 定義の一覧・追加・変更・削除・並び替え・候補                                           |
| `axes.ts`                | 軸ごとのファセット集計                                                                        |
| `smartFolders.ts`        | スマートフォルダーの CRUD・プレビュー・評価結果                                               |
| `fs.ts`                  | 物理 FS ブラウズ（Files モード）                                                              |
| `media.ts`               | カバー画像・音声・ワークスペースファイルの配信                                                |

契約上の要点:

- `GET /works` は常にページングエンベロープ `{ items, total }` を返す（page/limit 省略時は page=1, limit=200）
- 作品の変更系（`PATCH /works/:id`、タグの追加・削除など）は応答に `{ snapshot, projection }` を返す。`PATCH` は `sourceRevision` を要求する
- `POST /scan` は 202 で `{ job }` を即返し（`Location: /api/scan/:id`）、実行中の二重 POST は 409（`active` 付き）。`GET /scan/active` と `GET /scan/last` は該当なしのとき 204。進捗は `GET /scan/:id/events` の SSE（[ADR-0030](adr/0030-job-progress-sse-current-state.md)）。`GET /scan/last` はその実行のサマリー（件数・新規/更新作品ID・警告）だけを返し、要対応の現在状態は `GET /scan/diagnostics` の `{ identityConflicts, invalidMetaFiles }`、未登録候補は `GET /scan/candidates` から取る
- `POST /works/:id/resume` は高頻度のため `PATCH /works/:id` と分離している
- 音声は Range(206) 対応。カバーは `?w=128|256|512` でサムネイル（real は webp 化 + ディスクキャッシュ、fixture の SVG は原寸）

メディア URL は client の `entities/work/api.ts` の `getCoverImageUrl`/`getAudioUrl` が組み立てる（`<img src>`/`<audio src>` に直接使える）。

### タグの構造（編集時に注意）

`work.tags` には2種が混在する:

- Annotatedタグ（prefix付き）: `cv/水瀬なずな`、`サークル/月白製作所`、`シリーズ/...`、`カテゴリ/...`。軸表示がONのprefixは分類軸／ファセットの素になる
- フラットタグ: `ASMR`、`癒し系` 等の自由タグ

編集UIでは両方のタグを追加・削除できる。prefix定義で保護されたタグを削除するときだけ確認ダイアログを表示し、確認後は削除できる。prefix定義は軸表示・保護・ラベル・色を持つユーザー編集可能な設定データであり、特定prefixをコードで分岐しない。

タグは `shared/src/work.ts` の `normalizeTag` で正規化する。Annotatedタグはprefixをtrimして小文字化し、値をtrimする。フラットタグは全体をtrimする。`shared/src/api.ts` の `workSourcePatchSchema` がPATCH契約の入口で正規化を適用する。

クライアントの追加・削除ロジックは `entities/work/editableTags.ts` の `buildTagsWithAdded` / `buildTagsWithRemoved`、編集フローと保護確認は `features/library/ui/preview/useWorkTagEditor.ts` を参照する。PATCHの `tags` は全置換なので、変更後の全タグを送る。

## クライアントの状態管理

- **Jotai atom**: API由来でない UI 操作状態。ナビゲーション（後述の AppRoute）、library 表示設定（`features/library/model/atoms.ts`: libraryViewMode/libraryTileSize/libraryGridLayoutMode/axisValueSort/randomSeed）、player（後述）
- **TanStack Query**: サーバー状態。キーは `client/src/entities/<ドメイン>/queryKeys.ts` のファクトリで一元管理する（`WORK_QUERY_KEYS` / `TAG_QUERY_KEYS` / `SMART_FOLDER_QUERY_KEYS` / `SETTINGS_QUERY_KEYS` / `FILE_SYSTEM_QUERY_KEYS`）。広域 invalidate 用のプレフィックスキーも各ファクトリが持つ
- **ナビゲーションとURL同期**: 画面mode・Libraryの軸/タグ/選択作品/sort/検索語・Filesの場所/選択・作品詳細IDは `entities/navigation/model/appRouteStore.ts` の AppRoute 1つが正本で、各entityの `navigationAtoms.ts` はそこからの読み取り専用の派生。書き込みは各操作の write atom（次のrouteとpush/replaceを計算する純粋関数＋`navigate`）と履歴からの適用だけ。URLとの同期は `Providers` 直下の `NavigationHistorySync`（汎用の `shared/model/useRouteHistorySync.ts` に codec を渡す）が常時マウントで受け持つ（[ADR-0031](adr/0031-app-route-navigation.md)）。AddressBar の戻る/進む・パンくずも本物
- **scan / DLsite一括取得のジョブ追跡**: スナップショット・SSE接続・世代管理・終端検知は React 外の純 TS ストア（`entities/scan/model/scanJobStore.ts`、`entities/dlsite/model/dlsiteBulkStore.ts`）が持つ。同じ形で、`getState`/`subscribe`（状態）と `subscribeEvents`（終端などの一回きりの通知）、`start`/`cancel`/`attach`（サーバー上の実行中ジョブへの後乗り）/`reset`（ローカルの追跡だけを捨てる。サーバー側のジョブには触れない）を持つ。ストアは Jotai store ごとに1つ（`scanJobStoreAtom`/`dlsiteBulkStoreAtom`）で、操作は Runtime のマウントに依存しない。React からは `useScanJob`/`useDlsiteBulk` の `useStoreSelector` 経由の hook で読む。`ScanRuntime`/`DlsiteBulkRuntime` はイベントをトースト・キャッシュ更新へつなぐだけ
- **共通UIコンポーネント**: `client/src/shared/ui/` の `Button` / `IconButton` / `TagCombobox` を使う（CSSクラス直付けボタンは廃止済み。LeftNav と円形トランスポートだけ固有意匠のため例外）
- `App.tsx` はランタイム状態も TanStack Query も購読しない。`libraryTotalQuery` / `lastScanQuery` のような画面固有の購読は、それを使う消費者（`ScanModal` / `NotificationBell`）が自分で行う。この境界は `.oxlintrc.json` の `**/App.tsx` override で機械的に強制されており、`features/**/model/**` の import は deny-by-default（型モジュールだけ否定 glob で許可。player の `usePlayerActions` は `entities/player/model` にあるため制限対象外）

## プレイヤーのアーキテクチャ

プレイヤーの UI と audio ランタイムは `client/src/features/player/`、再生状態機械とコマンド層は他 feature からも使うため `client/src/entities/player/model/` に置く。UIは「画面下バー + 右下ポップアップ」（`PlayerDock.tsx` が AnimatePresence で切替）と、左ナビゲーションから常時アクセスできる「再生中タブ」（`NowPlayingView.tsx`。通常モード⇄没入モード）の構成。再生中タブの表示中は `PlayerDock` を描画しない（下部バー/ポップアップと再生中タブは同時に出さない）。

状態遷移は `PlayerController` 状態機械に集約している。model 層の分担（特記のないものは `features/player/model/`）:

- `entities/player/model/playerController.ts`: 再生状態の正。`PlayerControllerState`（`status`: idle/loading/playing/paused/ended/error、`PlaybackItem`、position/duration、volume/loop/playbackRate/channelSwap/abRepeat 等）と、入力→遷移+コマンドの純粋な `reducePlayer`、それを駆動する `PlayerController` クラス。聴了（トラック終端到達）もここのドメインイベントとして扱う。トラック切替は `withTrackIndex` が再生意図を決める: `intent: "preserve"`（次へ・前へ・自動送り）は現在の再生状態を維持し、`intent: "explicit"`（明示選択）は常に再生を開始する。実ロードへは `loadTrack` コマンド（autoplay・`reusesAsset` フラグ付き）で配線する。engine ロード済みトラック（`loaded`）・トラック終端待ち（`trackEnded`）・Files 即席トラックのファイル全体長（`fileDurationSec`）も state で持ち、区間トラックの仮想終端・同一音源の継続判定・再生し直し時の先頭復帰はすべて reducer の遷移（`audioTimeChanged` / `audioEnded` / `audioPlaying`）として扱う。`playRequests`（`PlayRequestGuard`）も持ち、`stopRequested` / `startRequested` の dispatch で未完了の作品再生要求を無効化する
- `entities/player/model/loadedTrack.ts`: engine ロード済みトラックの判別共用体（作品のトラック / Files のファイル）と、同一音源判定の純関数
- `entities/player/model/playerRuntime.ts`: controller と React の間で共有する参照型（`PlayerRuntimeRefs` / `PendingResume` 等。engine ハンドルとロードのクリーンアップだけを ref で持つ）
- `entities/player/model/atoms.ts`（他 feature からも読むため entity 層に置く）:
  - `playerCoreAtom`（低頻度 state。`toPlayerCoreState` で controller state から導出）
  - `playerCurrentTimeAtom` / `playerDurationAtom`（**高頻度**。timeupdate 毎に更新。`usePlaybackProgress` を介して **BarSeekStrip / PopupSeek / NowPlayingScrub の3 leaf だけが subscribe**する。親コンポーネント（BarContent / PopupContent / NowPlayingView）や App.tsx は subscribe しないので再生中に上位が再レンダリングされない — この分離は**維持必須**）
- `model/playerPresentationAtoms.ts`: プレイヤーの表示状態（いずれも localStorage 永続）
  - `playerUiModeAtom`（bar⇄popup）
  - `nowPlayingViewModeAtom`（再生中タブの通常⇄没入）
- `entities/player/model/audioEngine.ts`: 低レベル。`new Audio()`（DOM外）。load/play/pause/seek/setVolume/setPlaybackRate/setChannelSwap、timeupdate/durationchange/ended コールバック
- `model/useAudioEngineLifecycle.ts`: エンジンの生成と、engine イベント→controller 入力・`loadTrack` コマンド→実ロード/シークの変換、last-played 送信。遷移判定は持たない。同一アセットを再利用する経路は `<audio>` の `play()` がすでに再生中だとイベントを発火しないため、reducer が再生中の status を loading に戻さない
- `model/useResumePersistence.ts`: レジューム（playlistId/trackId/offsetSec）の保存・復元ポート
- `model/useMediaSession.ts`: OS のメディアキー・通知（Media Session API）連携
- `entities/player/model/trackTime.ts`: トラック区間（start/duration）とファイル絶対時間の相互変換の純関数
- `entities/player/model/usePlayerActions.ts`: 状態を持たず `PlayerController` へ dispatch するだけの薄いアクション束。`play` / `togglePlay` / `seek` / `seekRelative` / `setVolume` / `setLoop` / `nextTrack` / `prevTrack` / `setTrackIndex` / `playWithResume` / `setPlaybackRate` / `setChannelSwap`（L⇄R入替）/ `setABPoint`・`setABPointAt`・`clearABRepeat`（A-Bリピート。a < b のときだけ成立、B→A の順で設定すると自動で入れ替え）。レジュームの定期保存は `persistTick`（5秒間隔、`status === "playing"` のときだけ実際に保存する）
- `entities/player/model/usePlayWork.ts` / `workPlaybackRequest.ts`: 作品の再生開始の唯一の入口。`usePlayWork()` の `playWork(work, trackIndex)` / `resumeWork(work)` を各画面が直接呼ぶ。`requestWorkPlayback` が再生準備（`prepareWorkPlayback` → キャッシュ更新）と `PlayerController.playRequests` による鮮度確認（待ち中に後続要求・停止・別の再生開始があれば捨てる）、失敗時のトースト（root 再設定中のエラーは除く）を担い、通常再生と続きから再生の違いは開始処理だけ。root 再設定時は `rootReconfigurationController` が `stop()` を呼び、未完了の要求も無効になる
- `model/usePlayer.ts`（`usePlayerRuntime`）: controller ⇄ audioEngine ⇄ atoms を橋渡しするランタイム。`<PlayerRuntime />` 内でだけ呼ぶ
- `model/useNowPlayingImmersiveShell.ts`: 没入モード中、TopBar/AddressBar/LeftNav を inert 化し Escape で解除する
- `ui/PlayerDock.tsx`: バー⇄ポップアップの外枠・層切替。再生中タブ表示中は描画しない
- `ui/BarContent.tsx`（画面下バー）: カバー / トラック名 / 再生切替 + バー下辺に貼り付くシークバー（時間表示なし）。バークリックでポップアップへ
- `ui/PopupContent.tsx`（右下ポップアップ）: 大カバー / シーク / 前・次・ループ / ±10秒 / 倍速 / 音量 / 再生中の作品へジャンプ / 再生中タブへ遷移
- `ui/NowPlayingView.tsx`: 再生中タブ本体。通常モード（左カバー / 右トラックリストの横長2カラム + 下部固定バー）と没入モード（`NowPlayingImmersive.tsx`。ビューポート全面カバー）を切り替える
- `ui/useSeekDrag.ts`: シーク操作の共通フック（バー・ポップアップ・再生中タブで共用）

### ⚠ 自動検証の限界（音声）

headless Chromium（agent-browser / Playwright）は fixture の合成 8bit WAV の**メタデータをデコードしない**。そのため自動環境では duration/currentTime が 0:00 のままで、**シークバーが実時間で動く様子・続きから再生の位置seek は自動では確認できない**（通常再生も同様＝resume固有ではない）。トラック選択・UI状態までは確認可能。**実時間の再生／シークの手触りは実ブラウザ（Chrome で `mimi.localhost:1355`）で人が確認する**必要がある。

## 開発上のルール

Git・実装方針・デバッグ方法・タスク管理の共通ルールは [AGENTS.md](../AGENTS.md) が正（ここには重複させない）。HANDOFF 固有の補足だけ挙げる:

- コミットはユーザー指示があるまでしない（監督がレビュー後にまとめる）
- デザイントークンの正は `client/src/styles/tokens.css`（規約は [docs/design-system.md](design-system.md)）
- ドキュメント全体の地図は [docs/README.md](README.md) を参照
