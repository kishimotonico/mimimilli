---
id: TASK-466
title: ナビゲーション状態を型付きAppRouteへ一本化する
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 14:11'
labels:
  - refactor
  - architecture
  - navigation
dependencies: []
priority: medium
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/architecture-review-2026-09-20.md R4。8月のapplication-architecture-review-2026-08-12.mdからの再掲で、2回のレビューをまたいで未着手。

現在のコード根拠:
- client/src/features/navigation/model/useNavigationHistory.ts（購読とsetter群、URLからの適用、URL再構成）
- client/src/shared/model/navigationHistoryAtoms.ts
- client/src/entities/library/model/navigationActions.ts

画面mode、Libraryの軸・選択・検索、Filesの場所・選択、作品詳細IDが別々のatomへ置かれ、push/replaceの要求も別atomへ置かれている。useNavigationHistoryが全体を購読し、URLから個々のatomへ書き戻し、別のeffectでatom群からURLを再構成している。

決定事項（統括判断、新しいADRに記録する）:
- 型付きのAppRouteを一つの正本とし、navigate(route, { replace })とブラウザー履歴からの適用で更新する。
- Jotaiは廃止せず、一つのroute atomと派生atomで構成してよい。
- 表示密度・popoverなどURLと無関係な状態はAppRouteと分けたままにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 新しいADRでAppRouteの型設計・navigate(route, { replace })契約・派生atomの分け方を記録している
- [x] #2 画面mode・Libraryの軸/選択/検索・Filesの場所/選択・作品詳細IDがAppRoute型による一つの正本から導出される
- [x] #3 navigate(route, { replace })とブラウザー履歴からの適用のみがroute更新経路になり、useNavigationHistoryの個別setter群が無くなっている
- [x] #4 表示密度・popoverなどURLと無関係な状態は従来通りAppRouteと分離されている
- [x] #5 新しいroute項目を1つ追加する変更がAppRoute型定義とparse/serializeの追加だけで完結し、購読・適用・再構成の既存コードを変更せずに済むことをテストまたは実装例で示す
- [x] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
方針はADR-0031（docs/adr/0031-app-route-navigation.md）。確定設計からの差分3点（AppRouteの形・navigateのdirection・リセットでsortも既定へ）は統括の承認後に着手。

1. 汎用route層（shared/model、項目を知らない）
   - routeStore.ts: createRouteStore<R>(readInitial) → routeAtom（読み取り専用、atomWithLazy初期化）、navigateAtom(next|fn, {replace?, direction?})、履歴からの適用atom（同期専用）、未反映の履歴要求（push優先で合流、内部）、遷移方向atom、戻る/進む可否atom
   - useRouteHistorySync.ts: useRouteHistorySync(store, codec: RouteCodec<R>)。初回ロード/popstateはparse→(非正規形なら正規形へreplace)→適用のみ、route変化時はserialize(route)と現URLを比較し違えばpush/replace。historyマーカー・maxIndex・navigationHistoryBack/Forwardを移設
2. AppRoute層（entities/navigation/model）
   - navigationUrl.ts: features/navigation/model/navigationUrl.ts を移動（中身不変）
   - appRoute.ts: AppMode、AppRoute（library/files常時保持＋mode判別、workIdはworkDetailのみ）、DEFAULT_APP_ROUTE、appRoute↔NavigationUrlStateの対応、appRouteCodec
   - appRouteStore.ts: インスタンス、appModeAtom（派生）、modeの遷移純粋関数＋setAppModeAtom(push)/replaceAppModeAtom(replace)
3. 派生atomと遷移（純粋関数＋navigateを呼ぶwrite atom）
   - entities/library/model/navigationAtoms.ts: 5項目を派生に。libraryRouteTransitions.ts（setAxis/toggle/add/replace/clearTags/selectWork/setSort/setSearchQuery/goToSegment/showWork）、navigationActions.tsはそれを呼ぶatom。setLibrarySearchQueryAtom新設、showLibraryWorkAtom新設（App.handleOpenLibraryWorkの3連続setを1回のpushに）
   - randomSeedAtom・reshuffleは features/library/model/atoms.ts へ移動
   - entities/file-system/model/navigationAtoms.ts: 2項目を派生に、openPathInFilesAtomは常にpush。filesDirectionAtom削除（FilesViewは遷移方向atomを読む）
   - features/files/model/filesNavigationActions.ts: 遷移純粋関数＋atom（openDir push/forward、goToSegment・goUp push/back、select・clear replace）
   - entities/work: workDetailIdAtom派生、openWorkDetailAtomは遷移経由
4. 同期の常時マウント: features/navigation/ui/NavigationHistorySync を useRouteHistorySync(appRouteStore, appRouteCodec) に置換し Providers.tsx へ移す（App.tsxのoverlaysから削除）。Appを直接組むテストハーネス（appReconfiguringScreen・appRootSubscriptions・appReconfiguringStopsPlayback等）にも同期を追加
5. 469.2の3点セット統合: App.performReconfigurationEntryReset は navigate(DEFAULT_APP_ROUTE,{replace:true}) 1回。app/model/resetLibraryNavigationUrl.ts・resetNavigationToDefault.ts・resetLibraryNavigationAtom を削除
6. 呼び出し側の置換: TopBar（useAtom(librarySearchQueryAtom)→派生読み＋setLibrarySearchQueryAtom、setAppModeAtom import先）、LibraryView（setSearchQuery→setLibrarySearchQueryAtom）、LeftNav・AppShell・AppBody・AddressBar・PlayerDock・WorkDetailPage・WorkDetailBreadcrumbs・useLibraryPreviewActions・NavigationHistoryButtons・FilesView・useLibraryQueries・LibrarySortMenu のimport先変更、App.tsx（setAppMode/setLibraryAxis/selectLibraryWork→showLibraryWorkAtom、reset統合）
7. 削除: features/navigation/model/{useNavigationHistory,navigationAtoms,navigationUrl}.ts、shared/model/{appMode,appModeAtoms,navigationHistoryAtoms,navigationHistoryCommit}.ts、app/model/{resetLibraryNavigationUrl,resetNavigationToDefault}.ts、resetLibraryNavigationAtom、filesDirectionAtom、requestNavigationHistoryCommit系
8. テスト
   - 新規 routeHistorySync.test.tsx（汎用、テスト用route型とcodec）: 初回ロードの正規化は replace 1回・push 0回 (a)、popstate適用は履歴へ書かない (a)、非正規形popstateは replace 1回、navigate push/replace、同一フラッシュ内 push→push→replace は push 1回（旧navigationHistoryCommit.testの期待値を移設）、popstateの前後で遷移方向、戻る/進む可否。AC#5: テスト用route型へ項目を1つ足してcodecだけ変えた版でも同期が同じ振る舞いになることを同テストで示す
   - 新規 appRoute.test.ts: URL適用で他modeの状態を保持、serializeは表示中modeだけ、DEFAULT
   - 更新: navigationUrl.test.ts（import先のみ）、navigationAtoms.test.ts（書き込みをnavigate経由に）、libraryNavigationActions.test.ts（状態の前提はテスト用ヘルパーでroute seed、push/replaceの検証は純粋関数の戻り値で。期待値不変、変更点は報告で列挙）、openPathInFilesAtom.test.ts、appReconfiguringScreen（drift前提をnavigate経由に＋(b)(e)追加）、AddressBar/LibraryGridControls/librarySortMenu/LibraryBreadcrumbs/topBarSearch/topBarJobStatus/topBarUnregisteredBadge/FilePreview*/appRootSubscriptions/libraryWorksPaging の前提設定を tests/helpers のroute seedヘルパーへ
   - 削除: navigationHistoryCommit.test.ts（commit要求atom消滅、merge期待値は新テストへ移設）、resetLibraryNavigationUrl.test.ts（関数消滅）
9. 追加条件の担保: (a)上記unit。(b) appReconfiguringScreenに「reconfiguring表示中のnavigateで通常画面がマウントされない」「突入時にURLがその場で既定になる」を追加、App.tsxはrouteを読まない。(c) App.tsxはwrite atomのみ使いread APIを追加しない（lint変更なし）。(d) libraryNavigationActions.test は期待値不変。(e) 既存drift unit＋rootReconfiguration.smoke
10. smoke: 最後に test:smoke 全体（rootReconfiguration と library の goBack を含む）
11. コミット順: ADR → 汎用route層＋テスト → AppRoute層・派生atom・遷移・呼び出し側・同期移設（pnpm checkが通る単位で分割）→ 469.2統合 → 旧テスト整理
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計方針（アドバイザー承認 2026-09-25）: ADR-0031に記録予定。既存NavigationUrlStateをAppRouteへ昇格（URL形式不変）、routeAtom1つを正本に既存atomは読み取り専用の派生、navigate(route|fn,{replace})が唯一の書込口（action atomは次routeを計算する純粋関数+push/replace選択、ADR-0012/0013の規則はそこで維持）、URL同期は常時マウントの項目非依存の汎用コード、TASK-469.2の3点セット（resetLibraryNavigationUrl・resetNavigationToDefaultAtom・resetLibraryNavigationAtom）はnavigate(defaultRoute,{replace:true})1操作へ統合、randomSeed/filesDirectionはAppRoute外。

段階1確定（2026-09-25、アドバイザー承認）: ADR-0031（.worktrees/TASK-466/docs/adr/0031-app-route-navigation.md、未コミット）とplanを承認。承認設計からの変更3点も承認: (1)AppRoute={library: LibraryUrlState; files: FilesUrlState}&mode判別（library/files/nowPlaying/workDetail+workId）で画面をまたぐ状態を保持、NavigationUrlStateとparse/serialize・URL形式は不変、RouteCodecで表示中modeだけserialize・parse結果を現在routeへ重ねる (2)navigateにdirection?:forward|backを追加しfilesDirectionAtomは汎用の遷移方向atomへ (3)再設定突入時のnavigate(default,{replace})でsortも既定に戻す。段階2（実装）は未着手。担当プロンプト: 旧統括scratchpad stage2/prompt-466.md、plan原稿 stage2/plan-466.md（/tmp/claude-1000/-home-nico-projects-mimikago/2433d762-e137-4f62-b02a-634ef2eb3fa3/scratchpad/）。

段階2実装完了（2026-09-25）: task/466に4コミット（ADR→汎用route層→AppRoute化・469.2統合・呼び出し側/テスト→docs）。pnpm check・pnpm test（client 1210件・server 890件）・pnpm test:smoke（30件）すべて通過。AC#5はroutes/useRouteHistorySyncを項目を足したテスト用route型でも同一シナリオで検証（routeHistorySync.test.tsx）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ADR-0031。NavigationUrlStateをAppRouteに昇格し、routeAtom 1つを正本にした。画面mode・Library・Files・作品詳細の状態は読み取り専用の派生atomにした。書き込み口は navigate(route|fn,{replace,direction}) だけ。ADR-0012/0013のpush/replace規則は遷移の純粋関数に置いた。URL同期は項目を知らない汎用コード（shared/model/routeStore・useRouteHistorySync）にまとめ、Providersに常時マウントした。TASK-469.2の3点セットは navigate(DEFAULT_APP_ROUTE,{replace:true}) に統合した。Codexレビューの指摘（同一バッチでrouteが元の参照へ戻るとpush要求が残る）は是正済み。検証: pnpm check・pnpm test・pnpm test:smoke（30件）通過。是正後は check・test・smoke 2specを再実行。master 9d3fbad4 にマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
