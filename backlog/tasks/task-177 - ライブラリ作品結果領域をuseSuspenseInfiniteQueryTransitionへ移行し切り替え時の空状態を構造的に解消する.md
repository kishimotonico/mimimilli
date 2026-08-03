---
id: TASK-177
title: ライブラリ作品結果領域をuseSuspenseInfiniteQuery+Transitionへ移行し切り替え時の空状態を構造的に解消する
status: To Do
assignee: []
created_date: '2026-08-03 04:31'
labels: []
dependencies:
  - TASK-175
  - TASK-176
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
分類軸・ソート等の切り替えで queryKey が変わるたびに data が undefined へ落ち、レイテンシー下で空状態・スケルトンが一瞬表示される。keepPreviousData の全面適用は軸種をまたぐ切り替え（通常軸⇄スマート軸は別クエリ）で効かず、works/facet の確定時刻ずれで新旧データ混在も起きるため採用しない。React 19.1 + TanStack Query v5 の useSuspenseInfiniteQuery + Suspense 境界 + startTransition で、切り替え中は旧UIを保持したまま遷移する構造へ移行する。

確定仕様:
- 対象は作品結果領域（WorkGrid / ContentColumn の一覧本体）のみ。全ライブラリクエリの一括Suspense化はしない
- クエリ取得を LibraryView 直下から結果領域の子コンポーネントへ下ろし、同一 Suspense 境界に置く（自分自身の suspend は捕捉できないため）
- 軸・sort 等の Jotai atom 更新アクション（libraryNavigationActions.ts）を startTransition でラップし、isPending 中は結果領域に明示的な更新中表現（薄表示等）を出す
- 2ページ目以降の追加ロードは従来どおり isFetchingNextPage の末尾ローディング（Suspenseに落とさない）
- ライブラリ領域用の ErrorBoundary + QueryErrorResetBoundary を追加する
- useSuspenseInfiniteQuery は enabled 非対応のため、条件分岐は子コンポーネントのマウント有無で表現する
- 検索（250msデバウンス、effect経由のqueryKey変更）は Transition に乗らないため今回は既存挙動を維持し、変更しない

参考: client/src/features/library/model/useLibraryQueries.ts:68-111、LibraryView.tsx:47、tests/unit/libraryAxisFacetSwitch.test.tsx:106（キー変更で data 即 undefined を期待するテストは仕様変更に合わせて書き換えてよい）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 通信レイテンシーを模擬した状態で分類軸を切り替えても、旧一覧が保持されたまま新データへ差し替わり、空状態・スケルトンが表示されない（agent-browser + ネットワークスロットリングで確認し記録する）
- [ ] #2 切り替え中に更新中であることが視覚的にわかる（薄表示等のpending表現がある）
- [ ] #3 無限スクロールの追加ページ取得は末尾ローディング表示のままで、Suspense fallback に落ちない
- [ ] #4 結果領域のクエリ失敗時に ErrorBoundary が表示され、リトライで復帰できる
- [ ] #5 検索入力の挙動（250msデバウンス）が変わっていない
- [ ] #6 pnpm check と pnpm test が通る
<!-- AC:END -->
