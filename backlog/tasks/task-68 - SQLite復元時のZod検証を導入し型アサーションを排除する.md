---
id: TASK-68
title: SQLite復元時のZod検証を導入し型アサーションを排除する
status: To Do
assignee: []
created_date: '2026-07-19 03:09'
labels: []
dependencies: []
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘9。workRepo.ts:53,72の `row.status as WorkStatus`、375,387,443の `sort as SortId`、schema.ts:20-21の `$type<UrlEntry[]>()/$type<Playlist[]>()` はランタイム検証なしで、古いDB・手動編集・スキーマ不整合がそのままAPIへ流れる。

対応: DB行→ドメイン型の変換を1箇所に集約し、Zod（shared契約）で検証する。壊れた永続データは500ではなく診断可能なデータ整合性エラーとして扱う（過度なフォールバック禁止の方針どおり、隠蔽しない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DB行からドメイン型への変換が集約され、Zod検証を通る
- [ ] #2 workRepo.tsのstatus/sort等のas型アサーションが排除されている
- [ ] #3 不正な永続データが診断可能なエラーとして報告される（テストで検証）
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
