---
id: TASK-271
title: dlsiteMethodsを責務別に分割しキャッシュ適用仕様を明確化する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:28'
labels: []
dependencies:
  - TASK-263
priority: medium
ordinal: 281000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapters/real/dlsiteMethods.ts（716行）の createDlsiteMethods クロージャが約650行。
- runDlsiteBulk（:432-706, 約275行）を 対象選定・取得試行・適用 に分割
- fetchCachedDlsiteAttempt（:138-245）を キャッシュ解決 と HTML取得+記録 に分割
- Codexレビュー反映: cache hit時のnoOp判定（:580-590）のうち work.dlsite.status === "applied" を含む分岐は、bulk対象選定（:452-458）が applied を常に除外するため到達不能。デッドコードの削除として扱い、残る失敗cacheのスキップ条件を仕様として文書化・単純化する
- Codexレビュー反映: RJのみ自動検出・VJ非検出は docs/dlsite.md に明記された既定仕様（不整合ではない）。本タスクの対象から除外する
ファイルは dlsiteFetch / dlsiteApply / dlsiteBulk 等の責務別に分割する。永続化の共通関数はTASK-263の成果を利用する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createDlsiteMethods が責務別ファイルに分割され、275行級の関数が残っていないこと
- [ ] #2 serverテストが通ること
- [ ] #3 到達不能なapplied no-op分岐が削除され、残る失敗cacheのスキップ条件が仕様として文書化・単純化されていること
<!-- AC:END -->
