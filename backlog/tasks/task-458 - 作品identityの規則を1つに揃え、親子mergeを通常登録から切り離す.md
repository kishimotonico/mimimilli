---
id: TASK-458
title: 作品identityの規則を1つに揃え、親子mergeを通常登録から切り離す
status: Done
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0017-meta-source-projection-and-work-identity.md
ordinal: 512000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
孤立meta復元は Work ID の衝突時に Work・Playlist・Track を全再採番し、明示的な identity conflict 解決は Work ID だけを変更する。同じ「IDが衝突した」に2つの答えがある状態を解消する。あわせて、親作品の登録で子を解除する現行仕様を通常登録から切り離し、子が登録済みなら登録を拒否する。統合が必要な場合は子の解除を明示する独立操作として設計する。衝突条件は「同一 Work ID が別の物理パスで既に登録済み」であり、踏むと bookmark・resume・lastPlayedAt・追加日が失われ旧IDの行が孤立して残る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 子作品が登録済みのフォルダーを親として登録しようとすると拒否され、理由が表示される
- [x] #2 子の履歴を推測で親へ移送しない
- [x] #3 明示的な別作品化ではWork IDだけが変わり、Playlist/Trackは再採番されない
- [x] #4 単なる再投影・復元ではIDが変わらない。復元が無条件に別作品化しない
- [x] #5 統合が必要な場合は既存の子解除のあとに親を登録する手順で足り、新しい統合操作を追加しない
- [x] #6 IDが変わる場合にuser状態が新IDへ引き継がれない範囲が定義され、旧IDの行が既存作品に属する場合はその履歴を削除・移送しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ユーザーの決定は「子が登録済みなら親の通常登録を拒否する」であり、新しいmerge機能の承認ではない。

実測（2026-09-24）: 明示の別作品化（reassignIdentityConflict）は Work ID のみ変更。孤立meta復元（reassignMetaIdsOnDbCollision）は Work/Playlist/Track を全再採番し、missing でも別作品化する。親登録は mergeDescendantWorks で子を unregisterWork する。スキャン候補の registerFolderWork は子孫を見ない。設計: scratchpad/design-TASK-458.md

衝突規則を一本化した。復元は自動フォークせず再接続する（missing の同一IDは別パスでも再接続、live の同一IDは拒否）。親登録は拒否する（merge なし。子解除は既存 DELETE）。HTTP は既存 conflict(409) のまま、内部 code は descendants_registered / identity_conflict。apiErrorSchema は増やしていない。
<!-- SECTION:NOTES:END -->
