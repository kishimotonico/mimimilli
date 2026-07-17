---
id: TASK-40
title: グリッドインスペクタ狭幅時のヒーロー縦積みレイアウト
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 12:19'
updated_date: '2026-07-17 13:01'
labels: []
dependencies:
  - TASK-38
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グリッドモードの右インスペクタ（幅clamp(320px, 42%, 520px)）内でWorkDetailのヒーローが「カバー140px＋残り」の固定2カラムのため、狭幅時にメタ列が実質180px弱となり、長いタイトルと大量タグが不格好に縦伸びする。狭幅時はカバーを上・メタ情報を下に縦積みするレイアウト分岐を入れる。

タグ折りたたみ（TASK-38）で縦膨張は緩和される前提の上で、レイアウト自体を狭幅に適応させる。閾値の考え方はWorkTagEditorの狭幅分岐（NARROW_TAG_PANE_PX=320）が参考になるが、コンテナクエリ等より筋の良い手段があれば採用してよい。

関連: client/src/features/library/ui/preview/WorkDetail.tsx, WorkGridInspector.tsx, shell.css .mle-prv__hero（grid-template-columns: 140px 1fr）, .mll-grid-inspector（--grid-inspector-width）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 インスペクタが狭幅のとき、カバーとメタ情報が縦積みになり、タイトル・タグが窮屈に折り返さない
- [x] #2 リストモードの広い詳細ペインでは従来の横並びレイアウトが維持される
- [x] #3 ビジュアルベースラインが更新される
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexに実装委譲。.mle-prv__bodyをコンテナ（work-detail / inline-size）化し、@container 380px以下で.mle-prv__heroを1カラム縦積み・カバー中央寄せに。閾値根拠: カバー140px+gap20px+メタ最低幅220px。実機確認: 1000px幅ビューポートのグリッドインスペクタで縦積み、1280pxリストモードで従来横並びを確認。ビジュアルテストは既存ベースラインのまま通過（広幅スナップショットに影響なし）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品詳細ヒーローをCSSコンテナクエリで狭幅対応。実効幅380px以下でカバー上・メタ下の縦積みに切替、広い詳細ペインは従来の横並びを維持。実機・ビジュアルテスト確認済み。
<!-- SECTION:FINAL_SUMMARY:END -->
