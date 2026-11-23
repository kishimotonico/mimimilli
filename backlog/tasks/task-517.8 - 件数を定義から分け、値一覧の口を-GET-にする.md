---
id: TASK-517.8
title: 件数を定義から分け、値一覧の口を GET にする
status: Done
assignee: []
created_date: '2026-11-23 13:10'
updated_date: '2026-11-23 14:11'
labels:
  - server
  - shared
  - client
dependencies:
  - TASK-517.2
parent_task_id: TASK-517
priority: high
ordinal: 632000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SmartFolder から件数を外し、GET /smart-folders/counts で別に取る。値一覧と「＋絞り込み」の候補の口を作品一覧と同じ GET にする。スマートフォルダーまわりの関心を分ける（shared/src/smartFolder.ts、server の ClassificationAdapter）。ADR-0040 の HTTP の契約に従う。ADR-0008（80・113行）と ARCHITECTURE.md（65行）の matchCondition を createMatcher に直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /smart-folders は件数を含まず、件数は GET /smart-folders/counts が返す。定義を変える操作の応答は行だけを返す
- [x] #2 作品の状態変化（再生の開始、お気に入りの切り替え、登録解除）では件数のクエリだけが無効化され、定義の一覧は取り直されない
- [x] #3 値一覧の取得が GET で、groupBy はクエリの1文字列、groupSort は必須になっている
- [x] #4 shared のテンプレートと要求スキーマが smartFolder.ts と別のファイルにあり、condition.ts・smartFolder.ts・groupFilter.ts の型の循環が無く、server の ClassificationAdapter がスマートフォルダーとタグ prefix の口に分かれている
- [x] #5 matchCondition が残っておらず、ADR-0008 と ARCHITECTURE.md の記述が合っている
- [x] #6 real adapter で、ランダムの同じ seed による2回の取得が同じ順になり、ページを連結すると全件になることをテストが確かめる
- [x] #7 条件の契約テストに bookmarked・addedYear・text の独立した期待値がある
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
件数を GET /counts に分離、groups を GET（groupBy 必須）、shared と adapter を分割、matchCondition 削除、seed 再現と手書き期待値のテストを追加。常駐レビューで reorder の cancelQueries が件数の取得を取り消す件（exact:true）と整形の名残りを直した。random の並びの弱さ（seed % 72 の72通り）は既存の実装なので TASK-519 に起票した。
<!-- SECTION:NOTES:END -->
