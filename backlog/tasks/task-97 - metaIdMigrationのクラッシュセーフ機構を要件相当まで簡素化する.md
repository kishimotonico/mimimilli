---
id: TASK-97
title: metaIdMigrationのクラッシュセーフ機構を要件相当まで簡素化する
status: To Do
assignee: []
created_date: '2026-07-25 23:34'
labels: []
dependencies: []
priority: medium
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

`server/src/adapters/real/metaIdMigration.ts` は701行あり、専用テストも338行ある。実装されているのは次の機構。

- manifestのバージョニングと永続化
- `.bak` バックアップ
- 原子的リネーム
- checkpointによるキャンセル再開
- `VerifiedIdSignature` によるハッシュ再計算スキップキャッシュ

一方、requirements-v4 の 3.1 が求めているのは「複数のメタファイルに同一UUIDが存在した場合、後に検出された方を新規UUIDで再採番し、ユーザーに通知する」だけ。manifest永続化・バックアップ・段階的チェックポイント再開は要件文書のどこにも要求されていない。

呼び出し元は `server/src/adapters/real/scanner.ts:381` の1箇所のみで、スキャンのたびに全メタファイルへ無条件実行される。

ADR-0003の「失敗したら再スキャンで戻る」という設計思想からしても、ここまでのクラッシュリカバリは釣り合っていない。

## やること

「重複UUID検出 → 新規UUID採番 → 通知」の単純な処理へ絞り、manifest・バックアップ・チェックポイント・署名キャッシュを削除する。

削ることで失うのは「スキャンが途中終了した場合の再開最適化」だが、失敗時は次回スキャンで自然収束するため実害は小さいという判断。ただし削除前に、署名キャッシュが実際にどれだけスキャン時間を短縮しているかは計測して確認すること。計測の結果、無視できない差があるなら署名キャッシュだけは残す判断もありうる。

## 注意

破壊的変更は許容する。既存のmanifestファイルが残っていても壊れないようにだけすること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 重複UUIDの検出と再採番、ユーザーへの通知が従来どおり動作する
- [ ] #2 manifest・バックアップ・チェックポイント・署名キャッシュの機構が削除されている
- [ ] #3 削除前に署名キャッシュのスキャン時間短縮効果を計測し、結果を実装メモに記録している
- [ ] #4 既存のmanifestファイルが残っていてもスキャンが失敗しない
- [ ] #5 metaIdMigration.ts と専用テストの合計行数が削減されている
<!-- AC:END -->
