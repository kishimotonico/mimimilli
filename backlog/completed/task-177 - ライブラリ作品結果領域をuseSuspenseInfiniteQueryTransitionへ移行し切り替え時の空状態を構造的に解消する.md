---
id: TASK-177
title: ライブラリ作品結果領域をuseSuspenseInfiniteQuery+Transitionへ移行し切り替え時の空状態を構造的に解消する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-03 04:31'
updated_date: '2026-08-03 06:05'
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
- [x] #1 通信レイテンシーを模擬した状態で分類軸を切り替えても、旧一覧が保持されたまま新データへ差し替わり、空状態・スケルトンが表示されない（agent-browser + ネットワークスロットリングで確認し記録する）
- [x] #2 切り替え中に更新中であることが視覚的にわかる（薄表示等のpending表現がある）
- [x] #3 無限スクロールの追加ページ取得は末尾ローディング表示のままで、Suspense fallback に落ちない
- [x] #4 結果領域のクエリ失敗時に ErrorBoundary が表示され、リトライで復帰できる
- [x] #5 検索入力の挙動（250msデバウンス）が変わっていない
- [x] #6 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ライブラリの作品クエリと描画責務を調査し、結果領域を Suspense 配下の子コンポーネントへ分離する\n2. ナビゲーション atom 更新を Transition 化し、pending 表現・初回 fallback・結果領域用 ErrorBoundary/リトライを実装する\n3. 旧一覧保持、初回 fallback、追加ロード、未確定件数と0件の区別をテストで保証する\n4. pnpm check と pnpm test を実行し、失敗があれば修正して再検証する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
作品結果クエリを LibraryWorksBoundary 配下の useSuspenseInfiniteQuery へ移行。通常軸/スマート軸は子コンポーネントのマウントで分岐し、ナビゲーション action の startTransition と pending 薄表示、結果領域用 ErrorBoundary + QueryErrorResetBoundary の再試行を実装した。LibraryWorksBoundary.test.tsx で初回 fallback と遷移中の旧一覧保持から新一覧への差し替えを検証。2026-08-03: pnpm check 成功、pnpm test 成功（server 445、client 626）。ブラウザのネットワークスロットリング確認は委譲元が実施予定。

最終整理で未使用の旧 useLibraryQueries と非Suspense作品取得経路を削除し、paging・debounce・facet・patch cache sync のテストを新しい各hookへ移行した。最終再検証: pnpm check 成功、pnpm test 成功（server 445、client 625）。AC #1のブラウザスロットリング確認のみ委譲元待ちのためタスクはIn Progressのまま。

レビュー対応: queryKey不変操作で固着し得たlibraryNavigationPendingAtomとonSettled/resultKey解除機構を削除。Jotai actionをuseTransitionで包んだReactのisPendingだけで旧一覧保持・薄表示・解決後解除が成立することを結合テストで確認。最終検証: pnpm check成功、pnpm test成功（server 445、client 625）。

ブラウザ差分対応: LibrarySortMenu等のナビゲーションaction直呼びを廃止し、AppShell全体のLibraryNavigationProviderが所有する単一useTransitionへaxis/sort/drill/tags/segmentを統一。Provider共有を別操作/結果コンポーネントのsort遅延テストで確認。最終検証: pnpm check成功、pnpm test成功（server 445、client 625）。

レビュー差し戻し2件を経て確定: (1) libraryNavigationPendingAtomの固着リスク指摘→atom削除しuseTransitionのisPendingのみに簡素化。(2) LibrarySortMenuのatom直呼びでソート変更がtransition外だった問題→LibraryNavigationProvider（単一useTransition共有）へ統一し、パンくず・PlayerDock・DLsite通知モーダルの直呼びも同経路化。検証担当がSlow 3G相当（CDP latency 600ms）で実機検証: 軸・ソート切り替えの旧一覧保持と薄表示・解除、同値操作の固着なし、list/grid切り替え、検索デバウンス、初回ロード、コンソールエラーゼロを確認。無限スクロール追加ページはデータ11件のためブラウザ未観測（ユニットテストでカバー）。facet概要ページのpending表現は対象外構造のため未実証（不具合兆候なし）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品結果領域をuseSuspenseInfiniteQuery + Suspense境界 + 共有Transition（LibraryNavigationProvider）へ移行。軸・ソート等の切り替えは旧一覧を保持したままis-pending薄表示で遷移し、レイテンシー下の空状態ちらつきを構造的に解消。ErrorBoundary+QueryErrorResetBoundaryでリトライ導線を追加。スロットリング実機検証とユニットテストで確認、pnpm check/test通過。
<!-- SECTION:FINAL_SUMMARY:END -->
