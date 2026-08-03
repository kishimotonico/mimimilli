---
id: TASK-178
title: 軸値ファセットの契約を件数のみから総時間・代表カバーを含む形へ拡張する
status: To Do
assignee: []
created_date: '2026-08-03 14:44'
labels: []
dependencies: []
priority: high
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ再設計（ADR-0012 / DRAFT-50）の値一覧は、grid で代表カバー2×2コラージュ＋名前＋件数、list で コラージュ/名前/件数/総時間 の列を出す。現行の AxisFacetItem は { value, count } のみで総時間・カバーが取れないため、共有契約とサーバー実装（real / fixture / core）を拡張する。クライアント側の表示は後続タスクの担当で、本タスクは契約とデータ供給までを担う。

対象: shared/src/library.ts の axisFacetItemSchema / server/src/core/axisFacets.ts / server/src/adapters/real/workRepo.ts の getAxisFacets / server/src/adapters/fixture/index.ts

代表カバーは値ごとに最大4件、作品の追加日時の新しい順で選ぶ。cover が無い作品はスキップし、4件に満たない場合はある分だけ返す（プレースホルダーはクライアント側の責務）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AxisFacetItem が value / count / durationSec / covers（最大4件、各要素は WorkListItem.cover と同じ形）を持つ
- [ ] #2 GET /axes/:axis が year・tag・prefix いずれの軸でも拡張後の形で応答する
- [ ] #3 real アダプタと fixture アダプタが同一の契約で応答し、両者を通す既存の契約テストが更新されて通る
- [ ] #4 代表カバーは追加日時の新しい順に最大4件で、cover 未設定の作品は含まれない
- [ ] #5 durationSec がその値に属する全作品の再生時間合計と一致することをテストで検証している
- [ ] #6 値が1000件規模の軸で GET /axes/:axis の応答時間を実測し、拡張前後の差をタスクの実装ノートに記録している
<!-- AC:END -->
