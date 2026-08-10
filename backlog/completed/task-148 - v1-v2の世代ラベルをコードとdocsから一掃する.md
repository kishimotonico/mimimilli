---
id: TASK-148
title: v1/v2の世代ラベルをコードとdocsから一掃する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 13:00'
updated_date: '2026-07-30 16:39'
labels: []
dependencies:
  - TASK-130
priority: low
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
旧実装（Tauri期・旧単一DB期）はほぼ全て捨てており、v1/v2という世代区別を今後のノイズとして残したくない（2026-07-30ユーザー方針）。旧DB取り込みとresume v1変換の削除は TASK-130。本タスクは呼称の一掃を行う。

対象（把握済みの箇所。実施時に rg "v1|v2" で全域を再確認すること）:
- docs/HANDOFF.md「API 契約 v2（現行エンドポイント）」節題 → 「API 契約」へ。同「resume v2（playlistId/trackId/offsetSec）」表記 → 「レジューム」へ
- shared/src のコメント「API 契約 v2 の正典」
- client/src/features/player/model/useResumePersistence.ts の「resume v2」コメント
- server/tests/real/resumeV2.test.ts のファイル名・テスト名（TASK-130でv1変換ケースを除去した後に resume.test.ts 等へ）

注意: docs/requirements-v4.md のような文書自体の版数や、外部仕様の固有名は対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 コード・docs（アーカイブ除く）に世代ラベルとしての v1/v2 表記が残っていない（rg で確認。文書の版数・外部固有名は除く）
- [x] #2 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. rg "v1|v2" 全域確認
2. HANDOFF「API 契約 v2」節題・resume v2表記、sharedコメント、useResumePersistenceコメントを修正
3. resumeV2.test.tsをresume.test.tsへリネーム
4. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。ETag・DLsiteキャッシュのフォーマット版数（mimimilli-cover-v1等）は世代ラベルではなく表現バージョンなので意図的に残置。ADR・issuesアーカイブは対象外。全体check+test:server 355件+test:client 396件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
HANDOFF・README・shared/clientコメントからv1/v2世代ラベルを一掃し、resumeV2.test.tsをresume.test.tsへリネーム。
<!-- SECTION:FINAL_SUMMARY:END -->
