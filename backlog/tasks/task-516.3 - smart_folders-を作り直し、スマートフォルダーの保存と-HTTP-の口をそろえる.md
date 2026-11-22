---
id: TASK-516.3
title: smart_folders を作り直し、スマートフォルダーの保存と HTTP の口をそろえる
status: Done
assignee: []
created_date: '2026-11-21 20:23'
updated_date: '2026-11-22 06:53'
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
- [x] #1 migration 後に smart_folders が ADR-0040 の形で、all の行がある。migration と shared テンプレートの all の一致を見るテストがあり、fixture でも all が必ずある
- [x] #2 既定のスマートフォルダーは初回だけ投入され、全部消しても再起動で戻らない。テンプレートから追加で固定 ID の行を作れる
- [x] #3 既定のものの条件・グループ分けの変更と、all の削除・名前変更・条件変更をサーバーが弾く
- [x] #4 削除した行を復元の口で同じ ID・位置・作成日時のまま戻せる
- [x] #5 読めない condition_json の行があっても一覧 API が成功し、その行を condition: null で返して件数の対象から外す
- [x] #6 一覧の応答に、バッジを出すものと0件で隠す判定が要るものの件数が入り、空のライブラリでは0になる
- [x] #7 ADR-0040 の手動移行手順（控えの取得）を実データではなくフィクスチャの user DB で確かめている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
516.1 レビューからの引き継ぎ: (1) route は c.req.query() の全キーを要求スキーマに渡し tags だけ queries で上書きする。キーを選んで組むと tagOp が route で落ちて黙って AND になる。tagOp=OR が 400 になる route レベルのテストを置く。(2) 復元の口でテンプレート ID の行を戻すとき、条件・グループ分けがテンプレートと一致することをサーバーで照合する。壊れた行（condition null）の削除は取り消しを出さない。(3) 「すべて」の sort を null にさせない検証はサーバー側。(4) condition・sort・groupBy のどれかが読めない行は condition/sort/groupBy を null にした壊れた行として返す。

実装(516.3): 既定の投入は seedSmartFolders（1トランザクションで smart_folders_seeded を立てる）。復元は位置が埋まっていれば以降を+1して同じ位置へ戻す。壊れた行へ works/groups は409、PUT・DELETE は可。権限違反は403(forbidden)、「すべて」の sort null は400。旧 /axes の smartFolder フィルタは shared 型・route・アダプタから撤去。AC7: scratchpad/ac7 に migration 0000-0006 だけを適用した旧 user DB（旧スマートフォルダー2件・show_as_axis 付き tag_prefixes）を作り、MIMIMILLI_DATA_DIR 指定で ADR-0040 の sqlite3 控えコマンドを実行して name|sort|rules_json が取れることを確認。続けて real アダプタを起動し migration 0007 が適用され、一覧が all＋既定10本、旧2件は消え、tag_prefixes から show_as_axis が消え、smart_folders_seeded が立ち、控えを見ながら POST で作り直せる(201)ことを確認した。
<!-- SECTION:NOTES:END -->
