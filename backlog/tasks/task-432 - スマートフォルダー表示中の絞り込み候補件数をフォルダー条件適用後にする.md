---
id: TASK-432
title: スマートフォルダー表示中の絞り込み候補件数をフォルダー条件適用後にする
status: To Do
assignee: []
created_date: '2026-09-07 15:23'
labels:
  - ui
  - smart-folder
  - performance
dependencies:
  - TASK-428.11
  - TASK-428.24
priority: medium
ordinal: 453000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.24 から切り出し（DRAFT-74 Q-03 のオーナー決定に基づく）。スマートフォルダーを表示している間、「＋絞り込み」候補に出る件数がフォルダー条件を考慮せず、チップの選択タグだけで算出されている。候補件数をフォルダー条件適用後の件数にする。

現状: 候補件数は FilterChipAddButton → AxisValuePopoverPanel → useAxisFacetsQuery（GET /axes/:axis）が担い、buildAxisFacetFilterParams はチップの選択タグしか渡していない。

## 設計制約（オーナー決定 2026-09-08）

1. 軸ファセットAPIには生のルールを渡さず smartFolderId を渡す（GET /axes/:axis?smartFolder=<id> ＋ 既存の tags）。サーバー側でルールを解決する
2. ルール評価の実装は1本に保つ。/smart-folders/:id/works、/smart-folders/preview、/axes/:axis の3経路は同じ評価関数（core の evalSmartFolder と、ADR-0008 の SQL候補抽出→純粋関数評価の2段構成）を呼ぶだけにし、ファセット側に評価ロジックを複製しない。HTTPの入口が増えるのは問題ないが、評価の入口が増えるのは不可
3. 選択チップ（tags）との AND は、スマートフォルダー結果面の作品一覧と同じ順序・同じ意味論で適用する
4. 性能は large 相当1000件で /axes/:axis の応答時間を計測し、結果を本タスクに記録する。閾値を超えるなら設計を持ち帰る
5. DRAFT-50（ビュー軸とスマートフォルダーの評価経路統合）に、本タスクで評価関数を共有した事実を related として記録する（ドラフトは編集不可のため、本タスク側に記録し統括が対応する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマートフォルダー表示中の「＋絞り込み」候補件数がフォルダー条件適用後の件数になる
- [ ] #2 軸ファセットAPIは生のルールではなく smartFolderId を受け取り、サーバー側でルールを解決する
- [ ] #3 /smart-folders/:id/works、/smart-folders/preview、/axes/:axis が同じ評価関数を呼び、ファセット側に評価ロジックが複製されていない
- [ ] #4 選択チップとのANDが作品一覧と同じ意味論で適用され、fixture/real両アダプターを通す契約テストで件数の一致を縛っている
- [ ] #5 large相当1000件で /axes/:axis の応答時間を計測し、結果をタスクに記録している
- [ ] #6 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
