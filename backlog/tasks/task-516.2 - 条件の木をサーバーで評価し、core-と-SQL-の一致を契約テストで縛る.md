---
id: TASK-516.2
title: 条件の木をサーバーで評価し、core と SQL の一致を契約テストで縛る
status: To Do
assignee: []
created_date: '2026-11-21 20:23'
labels:
  - library
  - server
dependencies:
  - TASK-516.1
documentation:
  - docs/adr/0040-smart-folder-condition-tree.md
  - docs/adr/0008-persistence-topology-query-ownership-playback-ids.md
parent_task_id: TASK-516
priority: high
ordinal: 603000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0040「述語の意味」「評価の所有権」「ADR-0008 の例外表の改訂」の実装。core の matchCondition と buildEffectiveCondition（スマートフォルダー＋グループの値＋チップ＋検索語→1本の木、@year 擬似タグの写像もここだけ）、real の compileCondition（各葉で 0/1 を保証してから NOT・AND・OR を組む）、アダプタの口 queryWorks / groupWorks / countByConditions（どれも { now } を受ける）。seed はクライアントだけが発行し、sort=random で seed が無ければ 4xx。旧経路は次の段で消すので、この段では並べて置いてよい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fixture は matchCondition、real は compileCondition だけで一覧・値一覧・件数を返し、どちらもアダプタの口でスマートフォルダー ID・view・tagOp を受けない
- [ ] #2 基準時刻 now を route が1リクエストにつき1回作って渡し、core・SQL のどちらも自分で Date.now() を呼ばない
- [ ] #3 契約テストが同じ木を fixture と real に渡し、順序付きの作品 ID 列・total・グループの値と件数・件数を比べる1形式になっている
- [ ] #4 契約テストの木の生成器が意味表の境界（長さ不明、未再生、基準時刻ちょうど、not の下の不明な値）を必ず含む
- [ ] #5 sort=random で seed の無い要求を 4xx で弾き、サーバーは seed を発行しない
- [ ] #6 30k 作品ベンチで一覧・値一覧・件数を測り、基準値との比較と、prefix 派生列などの要否の判断をタスクのメモに残す
<!-- AC:END -->
