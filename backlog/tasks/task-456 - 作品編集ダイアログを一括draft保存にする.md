---
id: TASK-456
title: 作品編集ダイアログを一括draft保存にする
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-21 13:45'
labels: []
dependencies:
  - TASK-452
  - TASK-455
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
- [ ] #2 閉じる際の保存・破棄の挙動が一括draft方式と一致する
- [ ] #3 bookmark の更新が編集draftと混ざらない
- [ ] #4 背景取得とDLsiteの独立適用のいずれも、dirtyな入力を上書きしない
- [ ] #5 保護タグの確認時点と、undoが保存前draftへの取り消しか保存後の別コマンドかが決まっている
- [ ] #6 source確定済みで投影未反映の状態を、閉じる操作が未保存へ戻して再送しない
<!-- AC:END -->
