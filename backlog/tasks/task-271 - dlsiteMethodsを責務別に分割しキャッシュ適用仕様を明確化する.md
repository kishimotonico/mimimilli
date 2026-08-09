---
id: TASK-271
title: dlsiteMethodsを責務別に分割しキャッシュ適用仕様を明確化する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
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
- :541-590 cache hit時のnoOp判定が8条件比較になっている → 「どういう時に再適用をスキップするか」を仕様として明文化し、単純なルールに書き直す
- dlsite.ts:77-83 と dlsiteCache.ts:117-125 の不整合: detectRjCode はRJのみ、正規化はRJ/VJ対応で、VJフォルダがスキャン自動検出されない → VJも検出対象に統一するか仕様として明文化する
ファイルは dlsiteFetch / dlsiteApply / dlsiteBulk 等の責務別に分割する。永続化の共通関数はTASK-263の persistDlsiteApply を利用する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createDlsiteMethods が責務別ファイルに分割され、275行級の関数が残っていないこと
- [ ] #2 cache hit時のスキップ条件が仕様として文書化され、実装が単純化されていること
- [ ] #3 RJ/VJ検出の扱いが統一または明文化されていること
- [ ] #4 serverテストが通ること
<!-- AC:END -->
