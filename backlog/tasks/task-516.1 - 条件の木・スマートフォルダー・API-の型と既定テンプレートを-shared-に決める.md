---
id: TASK-516.1
title: 条件の木・スマートフォルダー・API の型と既定テンプレートを shared に決める
status: Done
assignee: []
created_date: '2026-11-21 20:23'
updated_date: '2026-11-22 06:18'
labels:
  - library
  - shared
dependencies: []
documentation:
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 602000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0040 の契約を shared に置く最初の段。条件の木（Condition）、保存できる形（ルート and 固定・直下は述語 / not(述語) / 述語だけの or / not(or)）の検証と正規化、GroupBy、SmartFolder と HTTP の型（ADR-0040「HTTP の契約」）、既定テンプレート（all を含む13本、固定 ID）、条件の形の判定関数（bookmarked 単独・hasError 単独など）を shared に置く。あわせて、旧経路のまま 30k 作品ベンチ（一覧・値一覧・件数）の基準値を取る。評価の実装はしない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shared に条件の木・GroupBy・SmartFolder・HTTP の要求と応答の Zod スキーマがあり、tagOp を受け付けない
- [x] #2 保存時の検証が ADR-0040 の保存できる形だけを通す（子の無い or、ルートが and でない木、2段以上の入れ子を弾く）
- [x] #3 正規化がルートの and を畳まず、内側の子1つの or を畳み、キー順を無視した構造の一致で重複を落とす
- [x] #4 条件の形の判定関数が正規化済みの木で bookmarked 単独・hasError 単独を判定し、単体テストがある
- [x] #5 既定テンプレート13本（初回に入れる11本の区別つき）が固定 ID・名前・条件・既定の並び・グループ分けを ADR-0040 の表どおりに持つ
- [x] #6 旧経路での 30k 作品ベンチの基準値（一覧・値一覧・件数）をタスクのメモに記録している
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
旧経路 30k 作品ベンチ基準値（AC#6）。測定: server/bench の seed で 30000 作品（bench:seed、rng 既定）を real アダプタ(SQLite)に投入し、bench:run（in-process Hono、warmup 3・20 回、p50/p95）。マシン: AMD Ryzen 5 PRO 5650GE 12 論理コア, WSL2, bun 1.3.14。コマンド: pnpm --filter @mimimilli/server bench:seed -- --out-dir /tmp/mimimilli-bench-5161 / bench:run -- --data-dir /tmp/mimimilli-bench-5161 --out-dir /tmp/mimimilli-bench-5161/out。516.2 は同じコマンドで新経路を測る。
一覧 p50(p95) ms: works-page-1 44.1(47.5) / deep-page(page=150) 303.6(306.8) / q検索 44.2(48.3) / tag検索 67.0(70.5) / sort title-asc 16.9 id-asc 16.8 added-desc 41.6 duration-desc 44.5 last-played 41.0 random 56.5 / smart-folder 条件なし 41.8(46.3) / smart-folder 条件あり(CV水瀬) 207.1(212.5)。
値一覧 p50(p95): axes/cv 236.3(242.3) / axes/サークル 239.6(244.1) / axes/tag 463.8(514.9) / axes/year 32.4(33.7) / axes/cv?smartFolder=条件あり 235.0(247.7)。
件数相当（旧経路に件数 API は無いので works の total で代用）: counts-views（recent・added・fav・error の4ビューを limit=1 で逐次）90.8(93.5) / counts-smart-folder-total（条件あり、limit=1）208.5(213.6)。
補足: 既存 bench.ts は Host ヘッダー無しで全リクエストが 403 になり 0.1ms 台の無意味な値を出していた。Host 付与と 4xx 検知を修正し、値一覧・件数のケースを追加した。
<!-- SECTION:NOTES:END -->
