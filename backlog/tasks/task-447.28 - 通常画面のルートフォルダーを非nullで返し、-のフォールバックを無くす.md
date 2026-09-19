---
id: TASK-447.28
title: 通常画面のルートフォルダーを非nullで返し、?? "/" のフォールバックを無くす
status: Done
assignee: []
created_date: '2026-09-11 08:34'
updated_date: '2026-09-11 09:26'
labels:
  - refactor
  - triage
dependencies:
  - TASK-447.21
parent_task_id: TASK-447
priority: high
ordinal: 501000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上（TASK-447.21 のレビューで判明）。App.tsx の settings?.rootFolder ?? "/"、FilesBreadcrumbs.tsx・WorkDetail.tsx・FilePreview.tsx の useRootFolder() ?? "/" は、起動ゲートにより通常画面では root が必ずある前提なのに、前提が崩れたら黙って "/" を使う。AGENTS.md のフォールバック禁止に沿い、不変条件を型で表す。TASK-447.21 の取り込み後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 entities/settings に通常画面用の非nullのルートフォルダー取得フックがあり、settings 未取得・rootFolder 無しのときは throw する。nullable 版は起動ゲート（App の startupState 判定・SetupScreen）専用として名前で区別されている
- [x] #2 通常画面のコンポーネントは非null版だけを使い、client/src で rootFolder の ?? "/"（および同種のルートフォルダーの既定値）が rg で0件
- [x] #3 FilesView の rootFolder prop が外れ、FilesView が自分で非null版を読む
- [x] #4 非null版の throw が RootErrorBoundary で起動状態の不整合として表示されることをテストで確認している
- [x] #5 挙動は通常の画面では変わらず、既存テストの期待値を変えていない（テストの組み立ての変更はタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
entities/settings/useSettingsQuery.ts: useRootFolder()を非null（string、未設定ならRootFolderNotSetErrorをthrow）に変更。nullable版はuseRootFolderOrNull()に改名。requireRootFolder(rootFolder)を非フック版として追加公開（App.tsxがhooks-order制約のため利用）。

変更ファイル: App.tsx（rootFolder変数を廃止しrequireRootFolder/useRootFolderOrNullへ、AppBodyへのrootFolder prop削除）、AppBody.tsx（rootFolder prop削除）、FilesView.tsx（自前でuseRootFolder()を読む）、FilesBreadcrumbs.tsx・FilePreview.tsx・WorkDetail.tsx（?? "/"削除）、useLibraryQueries.ts・LibraryView.tsx・WorkDetailPage.tsx・FilesAddressBarMenu.tsx（null分岐削除）。

AppModals/SettingsModalのrootFolder: string | nullはスコープ外として維持（"未設定"表示は独自のUI状態で?? "/"型のフォールバックではないため）。

テスト変更: appBodyDockedBarWiring.test.tsx（AppBodyのrootFolder prop削除）、AddressBar.test.tsx（renderAddressBarが常にsettingsにrootFolderをセットするよう変更、未指定時は"/library"）、workPatchListSync.test.ts・workPatchMutationScope.test.tsx（queryClientにSETTINGS_QUERY_KEYS.all()でrootFolder="/lib"を事前投入、以前はuseRootFolderがnullを返しても動いていたが非null化で必須に）。rootErrorBoundary.test.tsxにuseRootFolder()の投げをRootErrorBoundaryが「表示中にエラーが発生しました」で拾うケースを追加。期待値はどれも変更なし。

結果: pnpm check / pnpm test（server 798・client 1106全pass）/ pnpm test:smoke（25 passed）。fixtureでライブラリ・Files・作品詳細（プレビュー・全画面）・その他メニューの絶対パスコピーを実機確認、console errorなし。rg '(\?\?|\|\|)\s*"/"' client/src は0件。

レビュー指摘対応: AppModals/SettingsModalに残っていたrootFolder: string | null（'未設定'表示）はready分岐でしか到達しないため削除。SettingsModalが自分でuseRootFolder()を読む形にし、App→AppModals→SettingsModalのprops受け渡しを撤去。rootFolderStaleはnullチェック不要な単純比較に。settingsModal.test.tsをqueryClient.setQueryData経由でrootFolderを供給する形に更新（期待値は不変）。pnpm check・pnpm test（server 798・client 1106全pass）・pnpm test:smoke（25 passed）確認。コミット0c2adf9（task/447.28）。
<!-- SECTION:NOTES:END -->
