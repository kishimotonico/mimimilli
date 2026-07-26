---
id: TASK-104.2
title: アイコン規約をドキュメント化しADRを追加する
status: To Do
assignee: []
created_date: '2026-07-26 13:48'
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
- [ ] #1 docs/design-system.md にアイコン規約の節がある
- [ ] #2 アイコンライブラリ選定のADRが docs/adr/ に追加されている
- [ ] #3 ADRに却下した候補とその理由が記録されている
- [ ] #4 docs/README.md からADRを辿れる
<!-- AC:END -->
