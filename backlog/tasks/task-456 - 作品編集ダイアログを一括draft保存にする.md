---
id: TASK-456
title: 作品編集ダイアログを一括draft保存にする
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-21 10:49'
labels: []
dependencies:
  - TASK-452
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 510000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 で一括draft保存を採る決定に対応する。DRAFT-47 の保存モデル見直しのうち、作品編集ダイアログの保存方式を確定させたもの。対象は title・tags・urls とし、設定・bookmark・DLsite の重い操作は含めない。RJ/VJコードの取得と保存を「作品情報を取得」ボタンへ統合する方向は撤回しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 編集ダイアログの title・tags・urls が一括で保存される
- [ ] #2 背景取得で dirty な入力が消えない
- [ ] #3 閉じる際の保存・破棄の挙動が一括draft方式と一致する
- [ ] #4 保護タグの確認と undo の意味が一括保存後も成立する
- [ ] #5 bookmark の更新が編集draftと混ざらない
<!-- AC:END -->
