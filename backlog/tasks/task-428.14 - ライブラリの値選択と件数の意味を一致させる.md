---
id: TASK-428.14
title: ライブラリの値選択と件数の意味を一致させる
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 16:19'
labels:
  - ui
  - ux
  - library
dependencies: []
modified_files:
  - client/src/features/library/model/valueSelectionContract.ts
  - client/src/features/library/ui/AxisValueList.tsx
parent_task_id: TASK-428
priority: high
ordinal: 441000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib-browse-A-03/A-05/A-12/A-13。値一覧は選択中フィルタ込み件数を表示しながら主クリックで置換するため、表示件数と結果が一致しない。ADR-0012の置換既定を維持し、件数基準とAND追加の説明を統一する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 値の主クリック後の結果件数がクリック前に表示した件数の定義と一致する
- [x] #2 全ての値選択入口で置換とAND追加の操作方法が分かる
- [x] #3 AND追加の操作は非hover時とキーボードでも利用できる
- [x] #4 組み込み軸のチップへ@year等の内部表現を出さない
- [x] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
