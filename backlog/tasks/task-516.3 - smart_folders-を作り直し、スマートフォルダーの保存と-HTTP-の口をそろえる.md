---
id: TASK-516.3
title: smart_folders を作り直し、スマートフォルダーの保存と HTTP の口をそろえる
status: To Do
assignee: []
created_date: '2026-11-21 20:23'
labels:
  - library
  - server
dependencies:
  - TASK-516.2
documentation:
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 604000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0040「既定のスマートフォルダー」「保存先」「件数」「HTTP の契約」「移行」の実装。user migration で smart_folders を DROP→CREATE（condition_json・sort NULL 可・group_by_json・position）し「すべて」を INSERT、tag_prefixes.show_as_axis を DROP。既定は smart_folders_seeded で1回だけ投入。CRUD・並べ替え（全件の順序を送る PUT）・テンプレートから追加（固定 ID）・削除の復元（同じ ID・位置・作成日時）、読めない行は condition: null で返す。既定のもの（テンプレートの固定 ID）は名前・既定の並び・位置・削除だけ変更可、「すべて」は加えて削除と名前変更も不可。件数はサーバーが判定関数で対象を選び一覧の応答に載せる。値一覧と「＋絞り込み」候補は同じ口で任意の groupBy を受ける。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 migration 後に smart_folders が ADR-0040 の形で、all の行がある。migration と shared テンプレートの all の一致を見るテストがあり、fixture でも all が必ずある
- [ ] #2 既定のスマートフォルダーは初回だけ投入され、全部消しても再起動で戻らない。テンプレートから追加で固定 ID の行を作れる
- [ ] #3 既定のものの条件・グループ分けの変更と、all の削除・名前変更・条件変更をサーバーが弾く
- [ ] #4 削除した行を復元の口で同じ ID・位置・作成日時のまま戻せる
- [ ] #5 読めない condition_json の行があっても一覧 API が成功し、その行を condition: null で返して件数の対象から外す
- [ ] #6 一覧の応答に、バッジを出すものと0件で隠す判定が要るものの件数が入り、空のライブラリでは0になる
- [ ] #7 ADR-0040 の手動移行手順（控えの取得）を実データではなくフィクスチャの user DB で確かめている
<!-- AC:END -->
