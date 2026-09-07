---
id: TASK-436
title: 値一覧とファイル行のキーボード操作を作品一覧と揃える
status: To Do
assignee: []
created_date: '2026-09-07 19:58'
labels:
  - ui
  - keyboard
  - a11y
dependencies: []
ordinal: 457000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
responsive-keyboard-A-02。矢印キーが効く一覧と効かない一覧が混在している。TASK-428.12 が作品グリッド・作品リスト・トラック一覧に roving tabindex と矢印キー・Home/End・Enter再生・Escape選択解除を実装したが、監査所見 responsive-keyboard-A-02 の files 欄が挙げる AxisValueRows.tsx / AxisValueGrid.tsx / AxisValueQuickList.tsx / FileRow.tsx / FileColumn.tsx は TASK-428.12 の Modified files 欄の範囲外だったため未対応で残っている。値一覧側は現状 onKeyDown が皆無。

TASK-428.12 が新設した共通実装（client/src/features/library/model/gridNavigation.ts の Home/End 対応、client/src/features/library/ui/useWorkListKeyboardNav.ts、useWorkResultsDismiss.ts、client/src/shared/lib/focusVirtualItem.ts）を再利用し、独自実装を作らないこと。契約は docs/design-system.md に明文化済み。

TASK-428.13 のグローバルショートカット契約（SHORTCUT_EXEMPT_SELECTOR、Escape の階層、data-player-control）と衝突させないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 値一覧（AxisValueRows・AxisValueGrid・AxisValueQuickList）で矢印キー・Home/Endが作品一覧と同じ規則で動く
- [ ] #2 ファイル一覧（FileRow・FileColumn）で矢印キー・Home/Endが作品一覧と同じ規則で動く
- [ ] #3 各一覧がroving tabindexで、Tab一回で入り一回で抜けられる
- [ ] #4 gridNavigation.ts・useWorkListKeyboardNav.ts・focusVirtualItemを再利用し、キーボード操作の実装が重複していない
- [ ] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
