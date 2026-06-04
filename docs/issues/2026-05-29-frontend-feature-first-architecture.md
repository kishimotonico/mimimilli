# フロントエンドを feature-first 構成へ整理する

## 背景

現在の mimikago フロントエンドは、Claude Design で作成した mimimilli 系モックをベースに、実アプリとして必要な機能・仕様・画面構成を考え直している段階にある。

直近のリファクタで旧モック由来の到達不能コンポーネントは削除し、Tailwind v4 の基盤導入と主要バグ修正も完了した。一方で、今後しばらくはモックを作り込みながら UX と仕様を詰めるフェーズに入るため、早い段階でディレクトリ構成と責務境界を整理しておきたい。

現状は `components/` と `hooks/` を中心に整理されているが、機能追加が続くと以下のような問題が起きやすい。

- `App.tsx` が setup / settings / scan / player / library の orchestration をまとめて抱えている
- `api.ts` が全 API の集約になっており、機能単位の境界が見えにくい
- `types.ts` に domain type、UI state type、定数、parser が混在している
- `LibraryView.tsx` が data fetching、navigation state、preview 判定、smart folder 作成まで担っている
- `usePlayer.ts` が audio engine、resume persistence、UI state、format util をまとめて持っている
- `vite.config.ts` のモック API が大きく、モック作り込み時に設定ファイルがアプリ実装の置き場になりやすい

## 目的

モック作り込みフェーズで UI や仕様を高速に試せる状態を保ちつつ、後から実装を差し替えたり、Tailwind 移行を進めたり、テスト対象を切り出したりしやすい構成にする。

## 方針

厳密な Feature-Sliced Design を全面採用するのではなく、mimikago の現在規模に合う軽量な feature-first 構成へ段階的に寄せる。

また、今後のモック作り込みと実装拡張を考えると、状態管理ライブラリは早い段階で導入する。ここで重要なのは、全状態を 1 つのグローバルストアに寄せるのではなく、server state と client/UI state を明確に分けること。

- server state: 作品一覧、作品詳細、分類軸、スマートフォルダー、設定、スキャン結果など、API から取得・更新する状態
- client/UI state: 選択中の軸、ドリル状態、選択中作品、検索文字列、モーダル開閉、プレイヤー表示状態、テーマ、密度設定など、UI 操作で決まる状態

ライブラリ方針:

- server state は TanStack Query を採用する
  - fetch / cache / refetch / invalidation / mutation 後の再同期を自前実装しない
  - 現在の `scanVersion` のような手動再取得トリガーは query invalidation に置き換える
  - モック API と実サーバー API の切り替え時にも、UI 側の取得ロジックを安定させる
- client/UI state は Jotai を採用する
  - feature 単位で atom を colocate し、巨大な store を作らない
  - derived atom は「UI state のみから導出できる派生」に限定する（query params など）
  - server state と UI state の両方に依存する派生（例: `previewMode` は `selectedWorkId`(UI) と `selectedWork`(server query) の両方に依存する）は derived atom にせず、コンポーネント側で `useQuery` の結果と atom 値を組み合わせて計算する。`jotai-tanstack-query` などの追加依存は当面入れない
  - atom の粒度を細かくし、React Context の広範囲 re-render を避ける

レイヤー間の依存方向ルール:

- import の許可方向は `app → features → entities → shared` の一方向のみとする
- 上位レイヤーへの import（例: `entities` から `features` を参照）と、feature 間の直接 import は禁止する
  - feature 間で共有が必要なものは `entities` か `shared` に引き上げる
  - 例: `WorkSummary` は library / player / scan から参照されるため `entities/work` に置き、各 feature はそこを import する
- このルールにより循環依存を防ぐ（特に player が work 型を使う箇所で重要）
- 高頻度に更新される audio currentTime は慎重に扱う
  - すべてを Jotai に流すと不要な re-render を増やしやすい
  - player feature 内で購読範囲を限定するか、audio engine から必要な UI だけへ通知する
  - Jotai に載せる場合も `currentTimeAtom` の購読先を transport / fullscreen player に限定する

想定構成:

```txt
src/
  app/
    App.tsx
    AppShell.tsx

  shared/
    api/
      http.ts
      queryClient.ts
    lib/
      cn.ts
      format.ts
    ui/
      Icon.tsx

  entities/
    work/
      model.ts
      api.ts
      ui/
        CoverImg.tsx
        CoverPlaceholder.tsx
        WorkTag.tsx

  features/
    library/
      api.ts
      model/
        atoms.ts
        queries.ts
        useLibraryNavigation.ts
        useLibraryData.ts
      ui/
        LibraryView.tsx
        AxisColumn.tsx
        ContentColumn.tsx
        PreviewPane.tsx
        WorkRow.tsx

    player/
      model/
        atoms.ts
        usePlayer.ts
        audioEngine.ts
      ui/
        TransportBar.tsx
        FullScreenPlayer.tsx

    scan/
      api.ts
      model/
        queries.ts
      ui/
        NewWorkPopup.tsx

    settings/
      api.ts
      model/
        atoms.ts
        queries.ts
      ui/
        SettingsModal.tsx

    setup/
      ui/
        SetupScreen.tsx

  mocks/
    data/
    fixtures/
    handlers/
```

## 実施計画

### Phase -1: モック基盤と UI シナリオを整備する

状態管理や feature-first 化に入る前に、検証の土台を整える。構造整理を先に進めると差分が大きくなるため、まず「同じ fixture / scenario で画面を確認できる」状態を作る。

- `vite.config.ts` 内の mock state / handlers を `mocks` 配下へ移す
- Node/Vite 専用の mock server 実装は frontend `tsconfig.json` の対象にしない
- Vite config は mock middleware の接続だけにする
- モックデータを fixtures として分離する
  - 通常ライブラリ
  - 空ライブラリ
  - 新規作品あり
  - エラー作品あり
  - ファイル欠損あり
  - 長いタイトル / 大量タグ / 長時間作品
  - 再生中想定の作品
- scenario を切り替えられる入口を用意する
  - 最初は環境変数または mock state の定数でよい
  - UI から切り替える dev panel は別 issue でもよい
- 主要画面の fixture が増えても `vite.config.ts` が肥大化しない状態にする
- 余力があれば、軽量な component gallery または Playwright screenshot の計画を別 issue に切る

着手状況（2026-05-29）:

- [x] `vite.config.ts` から mock data / handlers を分離
- [x] Node/Vite 専用 mock server 実装を `mocks/devServer.ts` に移動
- [x] 初期データを `mocks/fixtures.ts` に分離
- [x] `MIMIKAGO_MOCK_SCENARIO` による最小の scenario 切り替えを追加
  - `default`
  - `empty`
  - `new-work`
  - `errors`
- [x] mock state 生成を `mocks/state.ts` に分離
- [x] mock HTTP helper を `mocks/http.ts` に分離
- [x] mock API handler を `mocks/handlers/*` へ責務別に分割
  - settings
  - scan
  - library
  - works / tags / presets / DLsite
  - assets
- [x] Node/Vite 側の mock server を `tsconfig.node.json` で直接型チェックできるようにする
- [x] fixture をさらに用途別に細分化する
  - works
  - tracks
  - presets
  - smart folders
- [x] component gallery または screenshot test の方針を決める
  - Phase -1 では実装しない
  - fixture / scenario と handler 分割を先に固め、visual regression は Phase 5 で Playwright screenshot を第一候補として検討する

### Phase 0: 状態管理の基盤を入れる

- `@tanstack/react-query` と `jotai` を導入する
- `shared/api/queryClient.ts` を追加し、`QueryClient` の生成場所を固定する
- `app/Providers.tsx` を追加し、`QueryClientProvider` と Jotai `Provider` をまとめる
- TanStack Query Devtools は開発時だけ使えるようにするか、導入を別判断にする
- query key の命名規則を決める
  - 例: `["works", params]`, `["work", workId]`, `["axisFacets", axis]`, `["smartFolders"]`, `["settings"]`
- Jotai atom の置き場所を feature 単位に限定する
  - `features/library/model/atoms.ts`
  - `features/player/model/atoms.ts`
  - `features/settings/model/atoms.ts`
- local state のままでよいものは無理に atom 化しない
  - 一時的な input draft
  - hover / focus
  - そのコンポーネント内だけで閉じる小さな UI state
- **derived atom の設計制約**: server state（Query）と UI state（Jotai atom）の両方に依存する派生値（例: `previewMode`）は Jotai derived atom にしない。コンポーネント内で `useQuery` の結果と atom を組み合わせて計算する。この制約を意識した上で atom 設計を行う

### Phase 1: API と型の境界を分ける

- `src/api.ts` を `shared/api/http.ts` と feature/entity API に分割する
  - `entities/work/api.ts`
  - `features/library/api.ts`
  - `features/scan/api.ts`
  - `features/settings/api.ts`
  - 必要なら `features/player/api.ts`
- `src/types.ts` を domain / feature 単位に分割する
  - `entities/work/model.ts`: `Work`, `WorkSummary`, `Track`, `Playlist`, `UrlEntry`, tag parser
  - `features/library/model/types.ts`: `AxisId`, `AxisFacetItem`, `SmartFolder`, `SortId`
  - `features/scan/model.ts`: `ScanResult`
  - `features/settings/model.ts`: `Settings`
- 互換のため、一時的に `src/types.ts` は re-export ファイルとして残してもよい
- **テスト import の追従に注意**: `tsconfig.json` は `exclude: ["src/test"]` のため、`pnpm build`(tsc) はテストを型チェックしない。テスト破壊はビルドでは検知できず、`pnpm test`(vitest) でのみ顕在化する
  - 現状テストは `src/test/api.test.ts`(`../api`)、`src/test/types.test.ts`(`../types`)、`src/test/usePlayer.test.ts`(`../hooks/usePlayer` の format 関数) を import している
  - `types.ts` だけでなく `api.ts`・`usePlayer` の format 関数も、移動するなら **re-export shim を残すか、同じコミットでテスト import を更新する**
  - 各ファイル移動の後は build だけでなく **必ず `pnpm test` を実行**して確認する

### Phase 2: Library feature を切り出す

- `components/Library/*` を `features/library/ui/*` に移動する
- `hooks/useLibraryView.ts` を `features/library/model/useLibraryNavigation.ts` に移動する
- `LibraryView.tsx` から fetch / derived state を `queries.ts` / atoms / `useLibraryData.ts` へ切り出す
- 作品一覧、分類軸、作品詳細、スマートフォルダー取得を TanStack Query 化する
- active axis / drill value / selected tags / selected work id を Jotai atom 化する
- scan 後の一覧更新は `scanVersion` prop ではなく query invalidation で行う
  - ただし `scanVersion` は現状 App.tsx が所有し（scan トリガー）LibraryView が消費している。完全に撤去できるのは、scan を Query mutation 化して invalidation を発行する側（App / scan feature）と、works/facets を `useQuery` 化する消費側（library feature）の両方が揃ってから。Phase 2 と scan feature 化（Phase 4 で扱う App orchestration）の協調が必要なので、移行途中は `scanVersion` を一時的に残してよい
- `LibraryView.tsx` は container として薄く保ち、表示コンポーネントに props を渡すだけに近づける
- smart folder 作成処理は UI 内の inline callback ではなく、feature action として整理する

### Phase 3: Player feature を切り出す

- `components/Player/*` を `features/player/ui/*` に移動する
- `hooks/usePlayer.ts` を `features/player/model/usePlayer.ts` に移動する
- DOM Audio / Web Audio API 操作を `audioEngine.ts` に切り出す
- resume persistence は `usePlayer` 内に直書きせず、player API または work API 経由に寄せる
- `formatTime` / `formatDuration` / `formatFileSize` は `shared/lib/format.ts` へ移動する
  - `src/test/usePlayer.test.ts` はこれらを `../hooks/usePlayer` から import しているため、移動時に同じコミットでテスト import を `../../shared/lib/format` などへ更新するか re-export を残す（Phase 1 の「テスト追従」注意と同様）
- player の UI state は Jotai atom に寄せるが、audio engine の高頻度イベントは購読範囲を限定する
- resume 保存や last played 更新は TanStack Query mutation または feature API 経由にする

### Phase 4: App orchestration を整理する

- `App.tsx` を `app/App.tsx` へ移動する
- shell layout を `app/AppShell.tsx` に分ける
- setup 完了判定、settings modal、scan result popup などの app-level state を `useAppBootstrap` などに切り出すか、feature 側へ委譲する
- keyboard shortcut は `app/model/useGlobalShortcuts.ts` などへ切り出す

### Phase 5: component gallery / visual regression を追加する

- Phase -1 の fixture / scenario を使って、主要 UI 状態を確認できる入口を作る
- Storybook を入れるか、軽量な `src/dev/ComponentGallery.tsx` に留めるかを判断する
- Playwright screenshot で最低限の visual regression を取れるようにする
- Tailwind 移行や feature-first 移行時の見た目回帰を検知しやすくする

## 非目標

- UI デザインの全面変更はこの issue の対象外
- Tailwind 移行の完了はこの issue の対象外
- Redux / Zustand / XState など、追加の状態管理ライブラリ導入は前提にしない
- すべての `useState` を Jotai atom に置き換えることは目的にしない
- ディレクトリ移動に便乗した大規模な挙動変更はしない

## 受け入れ条件

- `pnpm test` が通る
- `pnpm build` が通る
- `vite.config.ts` は mock middleware の接続だけを持ち、mock data / handlers の実体を持たない
- fixture / scenario が `mocks` 配下に分離されている
- `QueryClientProvider` と Jotai `Provider` の配置が `app` 層にまとまっている
- server state の取得が主要箇所で TanStack Query 経由になっている
- mutation 後の再取得が query invalidation で表現されている
- client/UI state のうち feature をまたぐものが Jotai atom として feature 配下に colocate されている
- 主要画面が現状と同等に表示される
  - ライブラリ一覧
  - 作品詳細
  - スキャン完了ポップアップ
  - 設定モーダル
  - 再生バー
  - フルスクリーンプレイヤー
- `src/api.ts` と `src/types.ts` が巨大な集約ファイルではなくなっている
- `LibraryView.tsx` の責務が UI composition 中心になっている
- `usePlayer.ts` から低レベル audio 操作が分離されている
- Query に移行した箇所で `isLoading`/`isError` が UI に反映されており、`.catch(() => {})` の握り潰しが解消されている
- `features → entities → shared` の依存方向ルールが守られており、feature 間の直接 import および上位レイヤーへの import が存在しない（移行後に rg で確認できる水準）

## リスク

- import path の移動が多いため、段階ごとに build を通す
- Phase -1 と状態管理導入を同時に進めると原因切り分けが難しいため、mock 基盤分離を先に完了させる
- feature-first に寄せすぎると小規模コンポーネントの置き場所が過剰に細かくなる
- `types.ts` の re-export を長期間残すと境界が曖昧なままになる
- Jotai atom を増やしすぎると状態グラフが散らばるため、feature 単位で colocate し、命名規則を揃える
- TanStack Query と Jotai の責務境界が曖昧になると、server state を二重管理して stale data の原因になる
- player の `currentTime` のような高頻度更新を安易に global atom 化すると描画負荷が増える
- player 周辺は副作用が多いため、Library より後に切り出す
- モック API を分離する際、Vite middleware の挙動を変えないようにする

## 自己レビュー

### 良い点

- 背景として、Claude Design のモックをベースに実アプリ仕様を考え直している現在フェーズが明記されている
- `components/` / `hooks/` から feature-first へ寄せる理由が、現状の具体的なファイル責務に紐づいている
- 全面移行ではなく段階的移行としており、モック作り込み中の速度を落としにくい
- 状態管理や feature-first の前に mock fixture / scenario を整え、以後の変更を検証しやすくする順序に修正されている
- 状態管理を先送りせず、server state と client/UI state を分けて早期導入する方針に修正されている
- TanStack Query と Jotai の併用により、API キャッシュと UI 状態をそれぞれ適した道具で扱える
- Library と Player を先に分ける判断は、アプリの中心機能と変更頻度に合っている
- `vite.config.ts` のモック肥大化も計画に含めており、モックフェーズの実害に対応している

### 見直した点

- 最初は `features/` のみに寄せる案だったが、`Work` は複数 feature から参照されるため `entities/work` を置く構成に修正した
- 最初は状態管理ライブラリ導入を非目標にしていたが、モック作り込み中に仕様・UI 状態が増えることを考えると早期導入の方が安全なので Phase 0 に追加した
- さらに見直し、状態管理の前に Phase -1 として mock API 分離と fixture / scenario 整備を置いた。これにより、状態管理移行後の画面回帰を同じモック状態で確認しやすくする
- Jotai 単独案も考えたが、API 由来の server state まで Jotai で持つと cache / invalidation / refetch を自前実装することになるため、TanStack Query と併用する方針にした
- MSW 導入は有力だが、今すぐ入れると作業範囲が広がるため、まずは Vite middleware の分離に留めた
- Tailwind 移行完了と同時にやると差分が大きくなりすぎるため、この issue は構造整理に絞った

### 残る懸念

- 実装時に一度で全 Phase を進めると差分が大きくなる。Phase ごと、できれば commit ごとに test/build を通すべき
- `src/types.ts` の re-export は移行補助として便利だが、完了条件に「最終的に削除または最小化」を入れるかは実装時に判断する
- App-level state の切り出しは設計の好みが出やすいので、TanStack Query / Jotai の導入後、Library / Player / mocks 分離を進めながら改めて判断する
- Jotai atom の colocate ルールを曖昧にすると後で探索性が落ちる。`model/atoms.ts` を基本形として、必要になった時だけ分割する

### Phase -1 追加後の再レビュー

- mock server を `src/mocks` ではなく root の `mocks/` に置く方針へ修正した。Node/Vite 専用コードを frontend `tsconfig.json` の対象から外せるため、型環境が混ざらない
- scenario 切り替えは UI dev panel ではなく環境変数から始める判断にした。現時点では再起動前提で十分で、状態管理導入前に余計な UI 状態を増やさない
- `default` / `empty` / `new-work` / `errors` の 4 つを最小セットにした。大量タグや長いタイトルは default fixture に既に一部含まれるが、必要なら後続で専用 scenario に分ける
- `vite.config.ts` を薄くできたため、今後 fixture や mock handler を増やしても Vite 設定そのものは肥大化しにくい
- 残る課題は mock handler 自体がまだ 1 ファイルに大きく残っていること。`state` と `http` helper は分離済みなので、次の小分けでは `handlers/works.ts`、`handlers/library.ts`、`handlers/settings.ts` のように分ける

### Claude 作業引き継ぎ後レビュー（2026-05-29）

- feature/entity/shared/app への移動、TanStack Query / Jotai 導入、player audio engine 分離、AppShell 分離は `pnpm test` / `pnpm build` が通る状態まで進んでいる
- レビューで、初回セットアップ時の `scanning` 表示が `scanMutation.isPending` と別経路になっており、二重送信防止が効かない問題を確認した
- `App.tsx` に `isCompletingSetup` を追加し、初回セットアップ中の pending state を `SetupScreen` に渡すよう修正した
- Phase -1 の続きとして、mock state 生成と HTTP helper を `mocks/state.ts` / `mocks/http.ts` へ分離した
- 検証: `pnpm test` / `pnpm build` / `git diff --check`
