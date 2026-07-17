---
id: TASK-40
title: グリッドインスペクタ狭幅時のヒーロー縦積みレイアウト
status: To Do
assignee: []
created_date: '2026-07-17 12:19'
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
- [ ] #1 インスペクタが狭幅のとき、カバーとメタ情報が縦積みになり、タイトル・タグが窮屈に折り返さない
- [ ] #2 リストモードの広い詳細ペインでは従来の横並びレイアウトが維持される
- [ ] #3 ビジュアルベースラインが更新される
<!-- AC:END -->
