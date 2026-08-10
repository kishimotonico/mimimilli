---
id: TASK-271
title: dlsiteMethodsを責務別に分割しキャッシュ適用仕様を明確化する
status: Done
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 10:45'
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
- [x] #1 createDlsiteMethods が責務別ファイルに分割され、275行級の関数が残っていないこと
- [x] #2 serverテストが通ること
- [x] #3 到達不能なapplied no-op分岐が削除され、残る失敗cacheのスキップ条件が仕様として文書化・単純化されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dlsiteMethods.ts 716行→60行（組み立てのみのファサード）。dlsiteFetch.ts(334)・dlsiteBulk.ts(401)・dlsiteApply.ts(94) へ分割し、275行級の関数は残っていない（最大は runDlsiteBulk の約158行で、対象選定・取得試行・単体適用へ委譲するオーケストレーション層）。削除した成功時no-op判定は、レビューの検証により「applied を含む一部条件」ではなく判定全体が到達不能だったと判明。対象選定が applied を常に除外し、targets の要素はループ中に再取得されない不変スナップショットのため status が事後的に applied になることもない。AND条件の1項が常にfalseで noOp 全体が常にfalseだったため、削除して常に書き込む形は旧コードと振る舞い完全一致。失敗時のスキップ条件は shouldSkipCachedFailureWrite として温存し4条件とも旧コードと1対1対応。docs/dlsite.md は誤解を招く旧記述を削除して現状のみを書く形へ書き換えた。軽微な指摘として attemptedAt の重複計算が2箇所にあるが役割は分離されており動作に影響なし。検証: pnpm check 成功、server 531 pass / 0 fail。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
dlsiteMethods.ts を dlsiteFetch・dlsiteApply・dlsiteBulk へ責務分割し、716行を60行のファサードにした。到達不能だった成功時no-op判定を削除し、失敗cacheのスキップ条件を独立関数化して docs/dlsite.md に明文化。永続化は TASK-263 のプリミティブを利用。pnpm check と server 531 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
