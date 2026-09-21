---
id: TASK-458
title: 作品identityの規則を1つに揃え、親子mergeを通常登録から切り離す
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-21 13:44'
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
- [ ] #1 子作品が登録済みのフォルダーを親として登録しようとすると拒否され、理由が表示される
- [ ] #2 子の履歴を推測で親へ移送しない
- [ ] #3 明示的な別作品化ではWork IDだけが変わり、Playlist/Trackは再採番されない
- [ ] #4 単なる再投影・復元ではIDが変わらない。復元が無条件に別作品化しない
- [ ] #5 統合が必要な場合は既存の子解除のあとに親を登録する手順で足り、新しい統合操作を追加しない
- [ ] #6 IDが変わる場合にuser状態が新IDへ引き継がれない範囲が定義され、旧IDの行が既存作品に属する場合はその履歴を削除・移送しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ユーザーの決定は「子が登録済みなら親の通常登録を拒否する」であり、新しいmerge機能の承認ではない。
<!-- SECTION:NOTES:END -->
