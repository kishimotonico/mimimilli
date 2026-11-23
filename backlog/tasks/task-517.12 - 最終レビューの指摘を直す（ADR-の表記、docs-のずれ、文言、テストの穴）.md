---
id: TASK-517.12
title: 最終レビューの指摘を直す（ADR の表記、docs のずれ、文言、テストの穴）
status: Done
assignee: []
created_date: '2026-11-23 18:59'
updated_date: '2026-11-23 19:07'
labels:
  - library
  - docs
  - client
dependencies: []
parent_task_id: TASK-517
priority: high
ordinal: 637000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fable の最終レビュー（統括の scratchpad の review-517-final.md の「master の前に直すもの」I1・D1〜D7・C1〜C5・T1〜T5）を直す。挙動は変えない（docs の記述を実装に合わせる。D1・D2 などで実装と ADR のどちらを正にするか迷うものは、オーナーの決定と ADR の意図に沿う側に寄せ、報告に書く）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ADR-0041 に「この並びを既定にする」「並び順メニュー」が残らず、画面の表記（「このソートを既定にする」「ソートメニュー」）と一致している
- [x] #2 ADR-0041（group の扱い、選択解除の条件、編集できる列、enter() の入り直しで今の並びを捨てること）と ADR-0028・0031・HANDOFF.md が実装と一致している（D1〜D7）
- [x] #3 画面の文言の「フィルタ」「分類」「消してください」が今の語彙（絞り込み、削除してください 等）になっている（C2・C3・C5）
- [x] #4 useSmartFolderEditor の同じ行の二重の引き当てが1回になり、readSmartFolderRow が name を保存と同じスキーマで検証している（C1・C4）
- [x] #5 前の結果の0件を取得中として扱うこと、WorkDetailPage の 404 から leaveMissingWorkDetail への配線、保存中の2回目の drop を受け付けないことをテストが確かめる（T1〜T3）
- [x] #6 重複したテスト（libraryNavigationActions.test.ts:724）が無く、テスト名に「既定の並び」「値の並び」が残っていない（T4・T5）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fable の最終レビューの I1・D1〜D7・C1〜C5・T1〜T5 を直した（ADR を実装に合わせ、文言・コード・テストを補う）。Fable の確認で nit 3件を追加で直した。pnpm test の「stop failed」「cleanup failed」は shutdown.test.ts がわざと投げる例外の表示で、統合ブランチでも同じ（不具合ではない）。
<!-- SECTION:NOTES:END -->
