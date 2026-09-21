---
id: TASK-458
title: 作品identityの規則を1つに揃え、親子mergeを通常登録から切り離す
status: To Do
assignee: []
created_date: '2026-09-21 10:49'
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
- [ ] #1 孤立meta復元のID衝突時に Work ID だけが変わり、Playlist/Track が再採番されない
- [ ] #2 再投影が勝手にIDを再採番しない
- [ ] #3 子作品が登録済みのフォルダーを親として登録しようとすると拒否され、理由が表示される
- [ ] #4 統合が必要な場合の子解除が独立した明示操作になっている
- [ ] #5 子の履歴を推測で親へ移送しない
- [ ] #6 再採番で失われるuser状態と旧IDの孤立行の扱いが決まっている
<!-- AC:END -->
