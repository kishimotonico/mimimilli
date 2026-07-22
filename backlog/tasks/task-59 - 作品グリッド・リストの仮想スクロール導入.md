---
id: TASK-59
title: 作品グリッド・リストの仮想スクロール導入
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-19 02:02'
updated_date: '2026-07-22 06:38'
labels: []
dependencies:
  - TASK-73
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid（client/src/features/library/ui/WorkGrid.tsx）はグリッド・リストとも全件をmap()でDOM化しており、仮想化がない。content-visibility:autoで描画は抑えられるがReact要素は全件生成され、30,000件で数十万DOMノード規模。ジャスティファイドレイアウトの計算・画像寸法確定ごとの全件再レイアウト、キーボード操作時の全タイルquerySelectorAll（O(N)）も問題。

方針: @tanstack/react-virtual 等による行単位の仮想化。TASK-73のページング（追加読み込み）と組み合わせる。リリース調整（Codexレビュー2026-07-19）: TASK-73でサーバーがデフォルトlimitを返すようになった時点で「次を読み込む」UIがないと残件へ到達できなくなるため、追加読み込みUIはTASK-73側で実装し本タスクはDOM最適化に専念する。キーボード移動は仮想化インデックス+レイアウト情報から算出（未マウント行へのスクロール+focus）。「画像寸法をDBへ保存して再レイアウトをなくす」案はサーバースキーマ・スキャナー・DTOを巻き込むため本タスクから除外し、必要なら別タスク化する。

2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 10,000件相当でも画面近傍の一定数だけがDOM化される
- [x] #2 末尾スクロールで次ページが読み込まれる（TASK-73の追加読み込みと連動）
- [x] #3 検索・軸・ソート変更時にスクロール位置とページ状態がリセットされる
- [x] #4 矢印キーで未マウント行へ移動でき、スクロール+focusが追従する。aria-label・選択状態・Tab移動が退行しない
- [x] #5 インスペクター開閉・タイルサイズ変更・1:1/ジャスティファイド切替後も表示位置・レイアウトが破綻しない（TASK-45の機能を退行させない）
- [x] #6 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. @tanstack/react-virtual追加 2. WorkGrid: squareはcolumnCount個/行の固定高仮想化（タイル実幅+chrome+gapでestimateSize）、justifiedはJustifiedRowGroup行の可変高仮想化（rowHeights既知、layout再計算時virtualizer.measure） 3. キーボード移動をquerySelectorAll廃止の計算ベース化（computeGridColumnCount/getNextGridIndex/getNextJustifiedIndex活用）→scrollToIndex→レンダリング後focus 4. 末尾overscan検出で自動fetchNextPage（isFetchingNextPage/hasNextPageで抑制）、LoadMoreは末尾に維持 5. works変更でscrollToIndex(0)リセット 6. ContentColumnのWorkRowも行仮想化（概42px estimate+measureElement） 7. テスト: 純粋関数抽出中心（jsdom制約考慮、scrollElementサイズモックでDOM件数検証） 8. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
レビューで補正した点（監督側）: (1) テストデータのdlsiteを現行スキーマ（emptyDlsiteState）に修正、(2) ContentColumnの行高ずれ（estimateSize=42と実高の差が累積しビジュアル差分に）は.mll-wrowにblock-size:42pxを指定して行高を確定し解消（デフォルトmeasureElementはjsdomで無限ループのため不採用）、ビジュアルスナップショットは正当な変更としてPlaywrightで更新。(3) worksQueryKeyによるリセットはページ追加時に誤リセットしない設計（サブエージェント判断）を妥当と確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@tanstack/react-virtualでグリッド（square: columnCount個/行固定高、justified: JustifiedRowGroup可変高）とリスト（WorkRow行）を行仮想化。キーボード移動をquerySelectorAll廃止の計算ベース化（getNextGridIndex/getNextJustifiedIndex）→scrollToIndex→focus。末尾overscan検出で自動fetchNextPage（LoadMoreは末尾に維持）、worksQueryKey変更でscrollToIndex(0)リセット（ページ追加では誤リセットしない）。実装はimplementサブエージェント（kimi-k2.7-code）に委譲、監督側でレビュー・補正（dlsiteテストデータ・行高42px確定）・pnpm check/test/visual再実行。テストclient+15件、ビジュアルスナップショット更新。pnpm check・pnpm test(server214/client298)・pnpm test:visual(6件)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
