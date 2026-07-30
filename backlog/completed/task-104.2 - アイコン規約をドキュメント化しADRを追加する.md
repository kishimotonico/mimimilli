---
id: TASK-104.2
title: アイコン規約をドキュメント化しADRを追加する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-07-26 13:48'
updated_date: '2026-07-26 13:58'
labels: []
dependencies: []
parent_task_id: TASK-104
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/design-system.md にアイコンの規約を追記し、アイコンライブラリ選定の決定を ADR として記録する。規約にはアイコンの取得元・stroke 幅・サイズはIconButtonの契約に従うこと・製品固有アイコンの追加方法・呼び出し側から直接 import しないことを含める。ADR には Lucide 採用の根拠と、reicon・Its Hover・Tabler・自作維持を落とした理由、および既存SVGの出自が未記録である点を残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/design-system.md にアイコン規約の節がある
- [x] #2 アイコンライブラリ選定のADRが docs/adr/ に追加されている
- [x] #3 ADRに却下した候補とその理由が記録されている
- [x] #4 docs/README.md からADRを辿れる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetが執筆、統括担当がレビューしてコミット。docs/adr/README.md は索引ではなく執筆ガイドのため更新不要と判断。ADR番号は作成直前に確認して0009に採番(衝突なし)。
<!-- SECTION:NOTES:END -->
