---
id: TASK-274
title: shell.cssを面ごとのファイルへ分割する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 00:29'
labels: []
dependencies: []
priority: medium
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/styles/shell.css が約3400行の単一CSS。
Codexレビュー反映: mle- プレフィックスはframe・preview・player・filesで共有されており、「面別分割」と「prefixから定義先を予測」は両立しない。分割は base/frame・library・files・player・preview/shared 等の所有境界を明記して行い、import順（カスケード順序）も明文化する。プレフィックス由来の予測可能性はACにしない。
見た目の変更はゼロが前提（純粋なファイル分割）だが、現行smokeは視覚差分を検出しないため「見た目無変化」の完全担保はACにせず、既存smokeの操作回帰なしを確認する。docs/design-system.md の規約に従うこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 clientのcheckが通ること
- [ ] #2 所有境界とimport順（カスケード順序）が明文化された分割になっていること
- [ ] #3 既存smokeが全て通り操作回帰がないこと
<!-- AC:END -->
