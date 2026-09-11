---
id: TASK-447.19
title: 一覧のキーボード操作フックを shared/ui の1本にまとめる
status: To Do
assignee: []
created_date: '2026-09-11 08:05'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 487000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の1）。useGridKeyboardNav（グリッド／ジャスティファイド、仮想化）、useWorkListKeyboardNav（1列、仮想化）、useFileListKeyboardNav（1列、非仮想化）がほぼ同形で、features 間で共有できず files に複製されている。shared/ui/useListKeyboardNav.ts に1本化する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shared/ui/useListKeyboardNav.ts が columnCount・justifiedTiles（{rowIndex, centerX} の配列）・virtualizer（省略可）を受け、グリッド・ジャスティファイド・1列・非仮想化の全ケースを扱う
- [ ] #2 旧フック3本が削除され、WorkGrid・AxisValueGrid・WorkListPane・Files の一覧が新フックを使っている。削除したファイルへの参照がない
- [ ] #3 shared から features への依存がない（JustifiedLayout 型等を shared に持ち込まない）
- [ ] #4 フック単体テストが1本に統合され、旧3本のテストが縛っていた性質（端のクランプ、Home/End、仮想化時のスクロール、非仮想化時の即時フォーカス等）がすべて残っている
- [ ] #5 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
