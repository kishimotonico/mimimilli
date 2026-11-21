---
id: TASK-516.1
title: 条件の木・スマートフォルダー・API の型と既定テンプレートを shared に決める
status: To Do
assignee: []
created_date: '2026-11-21 20:23'
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
- [ ] #1 shared に条件の木・GroupBy・SmartFolder・HTTP の要求と応答の Zod スキーマがあり、tagOp を受け付けない
- [ ] #2 保存時の検証が ADR-0040 の保存できる形だけを通す（子の無い or、ルートが and でない木、2段以上の入れ子を弾く）
- [ ] #3 正規化がルートの and を畳まず、内側の子1つの or を畳み、キー順を無視した構造の一致で重複を落とす
- [ ] #4 条件の形の判定関数が正規化済みの木で bookmarked 単独・hasError 単独を判定し、単体テストがある
- [ ] #5 既定テンプレート13本（初回に入れる11本の区別つき）が固定 ID・名前・条件・既定の並び・グループ分けを ADR-0040 の表どおりに持つ
- [ ] #6 旧経路での 30k 作品ベンチの基準値（一覧・値一覧・件数）をタスクのメモに記録している
<!-- AC:END -->
