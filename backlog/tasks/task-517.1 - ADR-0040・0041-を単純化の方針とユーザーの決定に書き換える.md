---
id: TASK-517.1
title: ADR-0040・0041 を単純化の方針とユーザーの決定に書き換える
status: In Progress
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 12:56'
labels:
  - docs
dependencies: []
parent_task_id: TASK-517
priority: high
ordinal: 624000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-517 の決定（権限2段、値一覧でもチップと検索語を効かせる、エラーを常に出す、総称を画面に出さない）と、以降の子タスクで消す仕組み（層の補正の引き継ぎ、np=1・openedBy、入り直しの3分岐、pushSameUrl、列ごとの PUT、壊れた行の正常系扱い、件数と定義の同居）を ADR に反映し、後続の実装の正にする。docs は追記でなく現在の状態に書き換える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ADR-0040 が権限2段・エラー常時表示・PATCH での部分更新・件数の別取得・壊れた行を厳密に読む方針を定めている
- [ ] #2 ADR-0041 が値一覧でもチップと検索語を効かせる行き先の規則、層の開閉と await 後の入り直しの単純な規則を定めている
- [ ] #3 消す仕組みの規則（補正の引き継ぎ、np=1、openedBy、0件で隠す条件、既定の条件の読み取り専用）が ADR から消えている
- [ ] #4 ADR-0026 との関係（値一覧でチップを効かせない前提の廃止）が書かれている
<!-- AC:END -->
