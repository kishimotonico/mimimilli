---
id: TASK-516.16
title: ライブラリの client のクエリキー・責務・重複を整理する（最終レビューの設計指摘）
status: Done
assignee: []
created_date: '2026-11-22 18:02'
updated_date: '2026-11-22 19:21'
labels:
  - library
  - ui
dependencies:
  - TASK-516.15
parent_task_id: TASK-516
priority: high
ordinal: 617000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の最終レビュー（Fable）とクロスレビュー（Codex）で見つかった、設計とコード品質の負債を統合ブランチ feat/library-folders で直す。TASK-516.15 の後に行う。指摘の詳細は実装メモ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品一覧と値一覧のクエリキーが smart-folder 側に並び、作品一覧を決める項目の列挙が1か所で、定義の編集はそのフォルダーのキーだけを無効化する（F3・F5）
- [x] #2 デッドコード・旧形の残り（F4）が無い
- [x] #3 smartFolderEditing.ts と core の責務・名前・型が整理され、shared の型と関数を使っている（F6・Fn8）
- [x] #4 遷移関数は resolveLibraryView の結果だけを読み、値一覧へ戻る API と entry state の codec が今の意味に合っている（Fn1〜Fn4）
- [x] #5 アイコン表と値一覧のポップオーバーの配線が1つにまとまり、サイドバーの props と hook の境界が整理されている（Fn5〜Fn7）
- [x] #6 壊れたスマートフォルダーの行が、id・列名・理由とともにログに出る（F7）
- [x] #7 R2〜R5 と、条件の表示でタグに # を付けない（U1）が反映されている
<!-- AC:END -->















## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 指摘（最終レビュー・クロスレビュー 2026-11-23。行番号は 221bbabd。516.15 の後に行う）

- F3 作品一覧を決める6項目の列挙が workPatchInvalidation.ts:14・LibraryView.tsx:162・LibraryWorksBoundary.tsx:121 に手書き。reset key を folderWorksKey から作り、buildWorksResetKey・WorksResetKeyInput を消す。
- F4 デッドコード: useLibraryNavigation.ts:187 の useLibraryTransition と libraryTransitionContext.ts・LibraryNavigationProvider（useLibraryView の startTransition ごと）、workQueryRepository.ts:367 runWorksQuery のページングなし分岐、conditionSql.ts:61 の text.conditions[0]!（textSearchCondition は {sql, bindings} を返す形に）、GroupByRow.icon と PREFIX_ICONS の genre、AppShell.tsx:45・AddressBar.tsx:27 の常時付く is-lib。
- F5＋A8 クエリキー: 値一覧のキー（WORK_QUERY_KEYS.scopedGroupValues、["groupValues","smartFolder",id,…]）を smart-folder 側に移し、作品一覧のキーと並べる。作品一覧の要求とキーは一覧取得側に置き、ブックマーク更新（workPatchInvalidation）から参照する形にする。定義の編集はそのフォルダーの works(id)・groups(id) の prefix だけを無効化する。
- F6 smartFolderEditing.ts の責務分け: groupByKey/groupByFromKey は entities（キーの隣）へ。isPredicateNode は shared の isPredicate を使う。`SmartFolder & { condition: Condition }` は ReadableSmartFolder、`ReturnType<typeof toWrite>` は SmartFolderWrite。server/src/core/smartFolderPolicy.ts（中身は insertFromTemplate だけ）は内容に合う名前に改名。
- F7 userWorkStateRepository.ts:361-381 の壊れた行で、id・列名・zod の issue を warn で1回出す（作品側の logDataIntegritySkips と同じ扱い）。
- Fn1 route の生の値と resolve 後の値の二重参照（libraryRouteTransitions.ts:82・:100・:194、LibrarySortMenu.tsx:56、useSmartFolderEditor.ts:165）。遷移関数は resolveLibraryView の結果だけを読む（ADR-0041）。
- Fn2 goToLibrarySegment(index)／nav.goToSegment(0) を「値一覧へ戻る」の引数なしの API にする。
- Fn3 appRoute.ts:68 の entry state は library のときだけ sort・seed を書く（読む側 :102 と対称に）。
- Fn4 LibraryUrlState.q を必須の string にし、`?? ""` を消す（ADR の型も直す）。
- Fn5 アイコン表の2重化（smartFolderDefinitions.ts:18・:37）を1つにし、サークル・カテゴリの食い違いを無くす。
- Fn6 GroupQuickOverlay・GroupValuePopover・GroupValuePopoverPanel の同じ配線を1部品に寄せる（ポータルの有無と placement を引数に）。
- Fn7 LibrarySidebarPanel の props と内部 hook の混在、LibrarySidebar と LibraryView の useSaveSearch(nav) の二重呼び出しを整理する。
- Fn8 shared/src/smartFolder.ts:298 の常に真の template 判定、usesBookmarked（workPatchInvalidation.ts:32）を shared/condition.ts へ、:54 は view.condition、useLibraryWorkPatchMutations の重複 JSDoc、features/library/api.ts 冒頭の古い依存方向コメント、Toast.tsx の bottom-[84px]（再生バーの高さへの暗黙の依存をトークンか変数に）。
- R2 docs/adr/0040:211 と workCacheUpdates.ts:105-106 の「再生は値の件数・総時間を変えず」を「開いている値一覧を動かさないことを優先する」に。
- R3 formatFilterChipLabel（libraryPresentation.ts:49-53）は isBuiltinPseudoTagKey を見る。FilterChipBand.tsx:43-47 の手分解は parseTag に。
- R4 server/tests/smartFolders.test.ts:429,435 の年の期待値を getUTCFullYear に。
- R5 server/drizzle/catalog/meta/0015_snapshot.json を drizzle-kit の生成物として正しい形にする（_meta・キー順）。
- U1 ユーザー決定（2026-11-23）: 条件の表示（smartFolderEditing.ts:52 tagLabel）でも prefix なしタグに # を付けない。ADR-0040 の表（:80 付近）も直す。

- 516.15 のレビューの nit: 作品一覧の resetKey に生の q が入っている（LibraryView.tsx:167・LibraryWorksBoundary.tsx:126）→ F3 で folderWorksKey（正規化済み）から作れば解消。SmartFolderDialogHost.tsx:17-20 の allSort が「一覧がまだ無い」と「すべての並びが読めない」を同じ null で表している → ready でなければ描画しない条件で区別する。
<!-- SECTION:NOTES:END -->
