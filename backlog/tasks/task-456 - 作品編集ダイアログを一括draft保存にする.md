---
id: TASK-456
title: 作品編集ダイアログを一括draft保存にする
status: Done
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-23 22:17'
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
- [x] #1 編集ダイアログの title・tags・urls が一括で保存される
- [x] #2 閉じる際の保存・破棄の挙動が一括draft方式と一致する
- [x] #3 bookmark の更新が編集draftと混ざらない
- [x] #4 背景取得とDLsiteの独立適用のいずれも、dirtyな入力を上書きしない
- [x] #5 保護タグの確認時点と、undoが保存前draftへの取り消しか保存後の別コマンドかが決まっている
- [x] #6 source確定済みで投影未反映の状態を、閉じる操作が未保存へ戻して再送しない
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
WorkEditDialog.test.tsx「保存に失敗した場合は閉じずエラートーストを表示し、入力値を保持する」は、mutateAsync 呼び出しを waitFor の条件にしているため reject→catch→setState の完了を待たずに alertdialog の消滅を評価するレースがある（TASK-462 検証中に10回中1回失敗、ベース5回は0回）。このタスクでダイアログを一括draft保存に作り替える際、保存失敗後の状態は UI の最終状態を waitFor で待つ形のテストにする。

AC5の決定（統括、2026-09-24）: 保護タグの確認はダイアログの draft 上でタグを削除する時点に出す。undo は保存前の draft への取り消し（サーバー通信なし、現行と同型のトースト）で、保存を押した時点で無効になる。保存後の別コマンドによる undo は採らない。draft の基準 snapshot と revision は、dirty なフィールドが外部（背景取得・DLsite 適用）で変わった場合は進めず、フィールドごとに「最新の値を使う／自分の編集で上書きする」を選ばせる。409 source_changed でも draft を消さない。
<!-- SECTION:NOTES:END -->
