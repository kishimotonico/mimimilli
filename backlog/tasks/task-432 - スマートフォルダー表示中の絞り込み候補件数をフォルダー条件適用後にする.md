---
id: TASK-432
title: スマートフォルダー表示中の絞り込み候補件数をフォルダー条件適用後にする
status: Done
assignee: []
created_date: '2026-09-07 15:23'
updated_date: '2026-09-09 15:39'
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
- [x] #1 スマートフォルダー表示中の「＋絞り込み」候補件数がフォルダー条件適用後の件数になる
- [x] #2 軸ファセットAPIは生のルールではなく smartFolderId を受け取り、サーバー側でルールを解決する
- [x] #3 /smart-folders/:id/works、/smart-folders/preview、/axes/:axis が同じ評価関数を呼び、ファセット側に評価ロジックが複製されていない
- [x] #4 選択チップとのANDが作品一覧と同じ意味論で適用され、fixture/real両アダプターを通す契約テストで件数の一致を縛っている
- [x] #5 large相当1000件で /axes/:axis の応答時間を計測し、結果をタスクに記録している
- [x] #6 pnpm test:smokeに新規失敗がない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#5計測結果（2026-09-10、real adapter、in-memory SQLite、実装担当計測）:
- データ: 1000作品（work-0000〜work-0999）、smartFolder条件=WHERE 長さ≥20分
- GET /axes/:axis?smartFolder=<id>（20回試行、adapter.getAxisFacets直接呼び出し）
  min=12.67ms max=64.11ms avg=25.86ms p50=24.09ms
- 参考: smartFolder未指定（従来のSQLファセット経路）
  min=4.79ms max=7.10ms avg=5.73ms
- 閾値超過なし。1000件規模でも数十msオーダーに収まっており、設計持ち帰りは不要と判断

DRAFT-50 への related 記録（制約5、2026-09-10 統括対応）: 本タスクで /axes/:axis のスマートフォルダー絞り込みを、既存の評価経路（resolveSmartFolderCandidateIds → listSummaries → evalSmartFolderRules の3段。ADR-0008）をそのまま呼ぶ形で実装した。これにより /smart-folders/:id/works・/smart-folders/preview・/axes/:axis の3経路が同じ評価関数を共有する。DRAFT-50 が扱うのは filterByView（固定ビューの switch）と evalSmartFolder の二層構造であり、本タスクはその二層構造自体には手を付けていない。ビュー軸側との統合は DRAFT-50 の判断課題として残る。なお backlog CLI にドラフトの編集手段が無いため（list/create/archive/promote/view のみ）、DRAFT-50 側への追記は行えず本タスク側に記録している。
<!-- SECTION:NOTES:END -->
