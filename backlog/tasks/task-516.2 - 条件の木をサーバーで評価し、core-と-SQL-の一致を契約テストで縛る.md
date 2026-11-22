---
id: TASK-516.2
title: 条件の木をサーバーで評価し、core と SQL の一致を契約テストで縛る
status: Done
assignee: []
created_date: '2026-11-21 20:23'
updated_date: '2026-11-22 06:36'
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
- [x] #1 fixture は matchCondition、real は compileCondition だけで一覧・値一覧・件数を返し、どちらもアダプタの口でスマートフォルダー ID・view・tagOp を受けない
- [x] #2 基準時刻 now を route が1リクエストにつき1回作って渡し、core・SQL のどちらも自分で Date.now() を呼ばない
- [x] #3 契約テストが同じ木を fixture と real に渡し、順序付きの作品 ID 列・total・グループの値と件数・件数を比べる1形式になっている
- [x] #4 契約テストの木の生成器が意味表の境界（長さ不明、未再生、基準時刻ちょうど、not の下の不明な値）を必ず含む
- [x] #5 sort=random で seed の無い要求を 4xx で弾き、サーバーは seed を発行しない
- [x] #6 30k 作品ベンチで一覧・値一覧・件数を測り、基準値との比較と、prefix 派生列などの要否の判断をタスクのメモに残す
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
516.1 レビューからの引き継ぎ: shared/src/api.ts の worksPageSchema に seed? が残っている。サーバーの seed 発行をやめるので新経路の応答には seed を載せない（旧スキーマの撤去は 516.6）。

新経路 30k ベンチ（AC#6）。516.1 と同じ seed・マシン・warmup3/20回。新経路に HTTP 口はまだ無い（516.3）ので adapter を in-process で直接呼ぶ（bench.ts の cond-* ケース）。HTTP 経由の基準値との差を除くため、旧経路も adapter 直呼びで測った（同条件）。
一覧 p50 ms: 新 条件なし page1 42.2 / 旧 44.1。deep-page(150) 新 309.7（旧HTTP 303.6）。text 51.6（旧q検索 44.2）。tag 1個+title-asc 新 32.5 / 旧 33.2（旧スマートフォルダー条件ありは候補全件読み込みで207）。random 66.6（旧56.5）。not(duration)+or(bookmarked,hasError) 34.1。
値一覧 p50: cv 新 238.9 / 旧 239.0、サークル 239.4、tag 新 481.2 / 旧 484.9、year 33.4（旧32.4）、条件あり(tag) cv 新 266.7（旧 235.0＝core 評価。SQL の条件が tags 結合の各行にかかる分だけ +30ms）。
件数 p50: 4条件(played・added30・bookmarked・hasError)を1クエリで合計 18.7（旧4ビュー逐次 93.2）。1条件ずつ4往復 39.9。4条件+not(hasPrefix cv) 55.3（hasPrefix の EXISTS 走査1本で約+36ms）。
判断: (1) 件数は『1クエリで SUM』を採用済み（個別の約2倍速、旧比5倍速）。(2) tags への prefix 派生列は不要。件数に出す条件は hasPrefix を含まず、含んでも+36ms。値一覧の prefix 絞りは既存と同じ substr/instr で旧と同速。必要になるのは hasPrefix を件数対象にする設計が入ったときで、その時に再計測する。(3) 件数の細かい無効化も不要（18.7ms）。(4) 値一覧は旧と同じ cv/サークル 240ms・tag 480ms で、新経路による悪化は無い。重さの正体は facet SQL（全 tags 結合行への ROW_NUMBER による代表カバー選別）で、改善するなら別タスクで『値ごとの代表カバー4件を集計の外で引く』形にする（この段では対策しない）。

addedYear の年は ISO 文字列の先頭4桁（UTC）で取る。旧経路の @year・年の軸と同じ挙動で core・SQL も一致しているため、この段では変えない（統括判断）。
<!-- SECTION:NOTES:END -->
