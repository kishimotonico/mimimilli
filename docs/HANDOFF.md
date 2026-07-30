# 引き継ぎドキュメント

mimimilli の現状と進行中の作業を、後続のエージェント／セッションが把握するための資料。

## このアプリは何か

DLsite/FANZA 等からダウンロードした音声作品（ASMR・ボイスドラマ等）をローカルで管理・再生する常駐 Web アプリ。タグ／分類軸ベースの検索と、物理フォルダー（ファイラー）の両モードを持つ。`.meta.json` を Source of Truth、SQLite を検索キャッシュとする。

名前は3つ使い分けている。アプリ・パッケージ名は `mimimilli`、リポジトリ／ディレクトリ名は旧名の `mimikago` のまま、portless のサービス名は短い URL を保つため `mimi`。いずれも意図的なので揃えようとしないこと。

アーキテクチャは [docs/ARCHITECTURE.md](ARCHITECTURE.md)、決定の経緯は [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。要件は [docs/requirements-v4.md](requirements-v4.md)。ドキュメント全体の地図は [docs/README.md](README.md)、未完了タスクは Backlog.md CLI（`pnpm backlog task list --plain`）。

## アーキテクチャ

構造・境界・データフロー（vite middleware / portless の開発時トポロジー含む）は [docs/ARCHITECTURE.md](ARCHITECTURE.md) を参照。HANDOFF 固有の補足:

- fixture アダプタはシナリオ切替（`MIMIMILLI_MOCK_SCENARIO` = default/empty/new-work/errors）と**合成メディア**（無音WAV・SVGカバー、Range対応）を持つ

### dev サーバーへの server/src 自動反映

fixture API は `ssrLoadModule` 経由の遅延読み込みで、`server/src`・`shared/src` の変更は watcher がモジュールグラフを無効化し**次の `/api` リクエストで自動反映される**（手動再起動は不要）。client 側（`src/`）は通常の HMR。ただし `shared/src` に新しい export を追加すると画面が白くなることがあり、その場合は dev サーバーの再起動が要る。仕組みの詳細は `client/vite.config.ts` の `fixtureApiPlugin` を参照。

### CSS レイヤー

`shell.css` にセレクタを足すときは必ずカスケードレイヤー内に置くこと（レイヤー外の素のセレクタが Tailwind ユーティリティを潰す不具合が過去に発生済み）。仕組みと規約は [design-system.md](design-system.md) の「クラス命名」節が正。

## 起動・検証コマンド

起動・デバッグの約束事（`pnpm dev` を勝手に実行しない、アクセスは `http://mimi.localhost:1355`、agent-browser は `--session` 必須など）は [AGENTS.md](../AGENTS.md) が正。ここではコマンド一覧だけを持つ。

```bash
# ルートから（fixture アダプタ同居の通常開発）
pnpm dev            # client 起動。vite middleware が fixture API を /api/* にマウント
pnpm check          # shared/server/client の tsc + oxlint + oxfmt --check（これが通れば typecheck/lint/fmt の DoD を満たす）
pnpm test           # server (Bunランナー + node:test API) + client (vitest)
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
pnpm dev:real:server   # API サーバーのみ => http://api.mimi.localhost:1355（Bun。データルートはMIMIMILLI_DATA_DIRで上書き可）
pnpm dev:real:client   # client のみ。同じworktreeのapi.mimiへ向けて起動
pnpm smoke:real        # 固定のサンプル音声で real 経路を手動スモーク

# fixture サーバーを単体起動して curl 確認（合成メディアの検証等）
MIMIMILLI_ADAPTER=fixture PORT=18099 pnpm --filter @mimimilli/server start
```

ビジュアルテストの注意:

- スナップショットは**必ず Playwright で生成**する（agent-browser で撮った画像はレンダリングが違い、CI 比較で落ちる）
- パネル等の**要素単位**で `toHaveScreenshot` する。`fullPage` は半透明オーバーレイ越しの背景差分が許容差分に薄まり**偽パス**になる（scan結果ダイアログで実際に踏んだ。`role=dialog` 要素を撮る形に修正済み）
- 共有 fixture 状態に依存するため直列実行が前提（`playwright.config.ts`: workers:1 / fullyParallel:false / retries:2 / maxDiffPixels:1200。比率指定はレイアウト回帰を素通りさせた実績があり使わない）
- Codex のサンドボックスは Playwright（Chromium 起動・vite listen）が EPERM で動かないことがあるので、Codex に実装を委譲した場合もスナップショット生成は別の環境で行う

## API 契約 v2（現行エンドポイント）

すべて `/api` 配下。リクエスト/レスポンスは `shared/src/*.ts` の Zod スキーマが正典。エラーは `{ error: { code, message } }`（`apiErrorSchema`）。**下表はあくまで概観で、エンドポイントを追加・変更したときに更新漏れしうる。実装時は必ず `shared/src/` を直接確認すること。**

| メソッド     | パス                                                                  | 備考                                                                                                                      |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET / PUT    | `/settings`                                                           |                                                                                                                           |
| POST         | `/scan`                                                               | 同期実行（完了までブロックし ScanResult を返す）。実行中の二重POSTは409                                                   |
| GET          | `/scan/events`                                                        | スキャン進捗のSSE（progress/complete/error。再接続挙動は routes/scan.ts 冒頭）                                            |
| GET          | `/works`                                                              | **ページングエンベロープ `{ items, total }`**（page/limit省略時は全件）                                                   |
| GET          | `/works/:id`                                                          | 完全な Work（playlists・defaultPlaylistId・resume 含む）                                                                  |
| PATCH        | `/works/:id`                                                          | `{ title?, tags?, bookmarked? }` を統合（旧 PUT tags/title・POST bookmark を廃止）                                        |
| POST         | `/works/:id/resume`                                                   | `{ playlistId, trackId, offsetSec }`（`shared/src/work.ts` の `resumeSchema`。高頻度のため PATCH と分離）                 |
| POST         | `/works/:id/last-played`                                              |                                                                                                                           |
| POST         | `/dlsite/:id/fetch`                                                   | DLsite情報のプレビュー取得。失敗分類は `not_found / parse_error / error`                                                  |
| POST         | `/dlsite/:id/apply`                                                   | タイトル・カバー・選択タグを適用し、連携状態をメタへ保存                                                                  |
| PATCH        | `/dlsite/:id`                                                         | RJコード修正・skipped切替                                                                                                 |
| POST         | `/dlsite/bulk`                                                        | none/error作品の一括取得ジョブを開始                                                                                      |
| GET          | `/dlsite/events`                                                      | 一括取得ジョブの進捗SSE                                                                                                   |
| GET          | `/dlsite/notifications`                                               | RJコード未検出・取得失敗・パース失敗の件数サマリー                                                                        |
| GET          | `/dlsite/notifications/:kind`                                         | `rj-missing` / `fetch-failed` / `parse-failed` の該当作品一覧（詳細は docs/dlsite.md）                                    |
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
- **TanStack Query**: サーバー状態。キーは `client/src/entities/<ドメイン>/queryKeys.ts` のファクトリで一元管理する（`WORK_QUERY_KEYS` / `TAG_QUERY_KEYS` / `SMART_FOLDER_QUERY_KEYS` / `SETTINGS_QUERY_KEYS` / `FILE_SYSTEM_QUERY_KEYS`）。広域 invalidate 用のプレフィックスキーも各ファクトリが持つ
- **URL同期**: `features/navigation/`（`navigationUrl.ts` codec + `useNavigationHistory.ts` の history 同期層）。モード・軸・ドリル・タグ・選択作品・ソート・ファイルパスを URL に双方向同期。ナビ操作は `push`、選択/ソート等の軽微変更は `replace`。`requestNavigationHistoryCommitAtom` を各操作（useLibraryNavigation / useFilesNavigation / LeftNav の setMode）が叩いて push/replace を宣言する。AddressBar の戻る/進む・パンくずも本物
- **共通UIコンポーネント**: `client/src/shared/ui/` の `Button` / `IconButton` / `TagCombobox` を使う（CSSクラス直付けボタンは廃止済み。LeftNav と円形トランスポートだけ固有意匠のため例外）
- `App.tsx` はランタイム状態も TanStack Query も購読しない。`libraryTotalQuery` / `lastScanQuery` のような画面固有の購読は、それを使う消費者（`ScanModal` / `NotificationBell`）が自分で行う。この境界は `.oxlintrc.json` の `**/App.tsx` override で機械的に強制されており、`features/**/model/**` の import は deny-by-default（`usePlayerActions` 等の action フックだけ否定 glob で許可）

## プレイヤーのアーキテクチャ

`client/src/features/player/`。UIは「画面下バー + 右下ポップアップ + 全画面」の3層構成（バー⇄ポップアップは `PlayerDock.tsx` が AnimatePresence で切替）。

状態遷移は `PlayerController` 状態機械に集約している。model 層の分担:

- `model/playerController.ts`: 再生状態の正。`PlayerControllerState`（`status`: idle/loading/playing/paused/ended/error、`PlaybackItem`、position/duration、volume/loop/playbackRate/channelSwap/abRepeat 等）と、入力→遷移+コマンドの純粋な `reducePlayer`、それを駆動する `PlayerController` クラス。聴了（トラック終端到達）もここのドメインイベントとして扱う。トラック切替は `withTrackIndex` が再生意図を決める: `intent: "preserve"`（次へ・前へ・自動送り）は現在の再生状態を維持し、`intent: "explicit"`（明示選択）は常に再生を開始する。実ロードへは `loadTrack` コマンド（autoplayフラグ付き）で配線する
- `model/playerRuntime.ts`: controller と React の間で共有する参照型（`PlayerRuntimeRefs` / `LoadedTrack` / `PendingResume` 等）
- `model/atoms.ts`:
  - `playerCoreAtom`（低頻度 state。`toPlayerCoreState` で controller state から導出）
  - `playerCurrentTimeAtom` / `playerDurationAtom`（**高頻度**。timeupdate 毎に更新。`usePlaybackProgress` を介して **BarSeekStrip / PopupSeek / FullScreenScrub の3 leaf だけが subscribe**する。親コンポーネント（BarContent / PopupContent / FullScreenPlayer）や App.tsx は subscribe しないので再生中に上位が再レンダリングされない — この分離は**維持必須**）
  - `playerUiModeAtom`（bar⇄popup。localStorage 永続）
- `model/audioEngine.ts`: 低レベル。`new Audio()`（DOM外）。load/play/pause/seek/setVolume/setPlaybackRate/setChannelSwap、timeupdate/durationchange/ended コールバック
- `model/useAudioEngineLifecycle.ts`: エンジンの生成・イベント購読・last-played 送信。同一アセットを再利用する経路（再生中のトラックへ戻る等）では `<audio>` の `play()` がすでに再生中だとイベントを発火しないため、`audioPlaying` を代理で dispatch して状態機械を同期させる
- `model/useResumePersistence.ts`: resume v2（playlistId/trackId/offsetSec）の保存・復元ポート
- `model/useMediaSession.ts`: OS のメディアキー・通知（Media Session API）連携
- `model/trackTime.ts`: トラック区間（start/duration）とファイル絶対時間の相互変換の純関数
- `model/usePlayer.ts`: 上記を束ねて UI へ公開する React フック。`play` / `togglePlay` / `seek` / `seekRelative` / `setVolume` / `setLoop` / `nextTrack` / `prevTrack` / `setTrackIndex` / `setShowFullPlayer` / `playWithResume` / `setPlaybackRate` / `setChannelSwap`（L⇄R入替）/ `setABPoint`・`clearABRepeat`（A-Bリピート。a < b のときだけ成立、B→A の順で設定すると自動で入れ替え）。レジュームの定期保存は `persistTick`（5秒間隔、`status === "playing"` のときだけ実際に保存する）
- `ui/PlayerDock.tsx`: バー⇄ポップアップの外枠・層切替
- `ui/BarContent.tsx`（画面下バー）: カバー / トラック名 / 再生切替 + バー下辺に貼り付くシークバー（時間表示なし）。バークリックでポップアップへ
- `ui/PopupContent.tsx`（右下ポップアップ）: 大カバー / シーク / 前・次・ループ / ±10秒 / 倍速 / 音量 / 再生中の作品へジャンプ / 全画面展開
- `ui/FullScreenPlayer.tsx`: 全画面。トラックリスト・シーク・音量・ループ。ネイティブ `<dialog>` + `showModal()` の完全モーダル（フォーカストラップ・Esc はブラウザ標準に委譲）
- `ui/useSeekDrag.ts`: シーク操作の共通フック（バー・ポップアップ・全画面で共用）

### ⚠ 自動検証の限界（音声）

headless Chromium（agent-browser / Playwright）は fixture の合成 8bit WAV の**メタデータをデコードしない**。そのため自動環境では duration/currentTime が 0:00 のままで、**シークバーが実時間で動く様子・続きから再生の位置seek は自動では確認できない**（通常再生も同様＝resume固有ではない）。トラック選択・UI状態までは確認可能。**実時間の再生／シークの手触りは実ブラウザ（Chrome で `mimi.localhost:1355`）で人が確認する**必要がある。

## 開発上のルール

Git・実装方針・デバッグ方法・タスク管理の共通ルールは [AGENTS.md](../AGENTS.md) が正（ここには重複させない）。HANDOFF 固有の補足だけ挙げる:

- コミットはユーザー指示があるまでしない（監督がレビュー後にまとめる）
- デザイントークンの正は `client/src/styles/tokens.css`（規約は [docs/design-system.md](design-system.md)）
- ドキュメント全体の地図・正典/削除済みの区分は [docs/README.md](README.md) を参照
