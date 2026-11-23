---
id: TASK-517.4
title: 既定のスマートフォルダーを自作と同じに編集できるようにし、エラーを常に出す
status: Done
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 14:26'
labels:
  - library
  - shared
  - client
dependencies:
  - TASK-517.8
parent_task_id: TASK-517
priority: medium
ordinal: 627000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サーバーの権限は 517.2 で2段になっている。画面を合わせる。「すべて」以外の既定のスマートフォルダーは、自作と同じく条件とグループ分けを変えられる。0件の「エラー」を隠す規則（isHiddenWhenEmpty・needsCount・データ不整合の件数の配線・開いている間は残す・編集中は薄く）をなくし、常に出す。design-system.md の該当箇所（212・221行付近）も直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 「すべて」以外の既定のスマートフォルダーで、編集のダイアログから条件とグループ分けを変えて保存でき、上書きも出る
- [x] #2 アイコンは条件の形とグループ分けから引かれ、既定の条件を変えたときに見合ったアイコンになる
- [x] #3 0件の「エラー」の行がサイドバーに出続け、0件のときは件数の赤い丸を出さない（ほかの行の0はそのまま出す）
- [x] #4 画面の出し分けが「すべて」かどうかだけで決まり、smartFolderPermissions の6フラグと isHiddenWhenEmpty・needsCount が残っていない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
権限の型を削除し出し分けは「すべて」かどうかだけ、アイコンは条件の形・並び・グループ分けから（ADR-0040 に述語1つの対応を追記）、エラーは常に出す。smoke 72 通過、常駐レビュー important なし。pnpm test の client 1件の一過性の失敗はレビュー担当の3回の再実行で再現せず。
<!-- SECTION:NOTES:END -->
