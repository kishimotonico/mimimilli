---
id: TASK-517.2
title: スマートフォルダーの API とデータの形を単純にする
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 12:50'
labels:
  - server
  - shared
dependencies:
  - TASK-517.1
parent_task_id: TASK-517
priority: high
ordinal: 625000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
列ごとの PUT（/condition・/sort・/group-sort）と PUT /:id を PATCH /smart-folders/:id の部分更新1本にし、件数を定義から分け、値一覧の取得と復元の口の形をそろえる。shared/src/smartFolder.ts の関心を分け、client も shared の要求型を通す。ADR-0040 の HTTP の契約に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマートフォルダーの更新が PATCH /smart-folders/:id 1本で、送った列だけが更新され、不変条件（groupBy と groupSort の組、「すべて」の制約）は更新後の行で1関数が検証する
- [ ] #2 件数は GET /smart-folders/counts で別に取り、作品の状態変化（再生開始など）では件数のクエリだけが無効化される
- [ ] #3 値一覧の取得が作品一覧と同じく GET で、削除の取り消しと「既定から追加」が作成の口に寄せられている
- [ ] #4 「すべて」の定義が起動時の初期化1か所にあり、migration の INSERT と一致を確かめるテストが無い
- [ ] #5 条件の木の子の個数とチップの個数に上限があり、超えると 400 になる
- [ ] #6 client の API 本文が shared の要求型を通り、使われない要求型と matchCondition が残っていない
- [ ] #7 real adapter で、ランダムの同じ seed による2回の取得が同じ順になり、ページを連結すると全件になることをテストが確かめる
<!-- AC:END -->
