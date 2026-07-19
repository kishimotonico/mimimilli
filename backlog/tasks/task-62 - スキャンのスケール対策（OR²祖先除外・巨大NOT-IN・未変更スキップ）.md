---
id: TASK-62
title: スキャンの計算量・SQLite上限対策（O(R²)祖先除外・巨大NOT IN）
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-19 02:03'
updated_date: '2026-07-19 13:01'
labels: []
dependencies: []
priority: high
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）により旧TASK-62を分割した1つ目（62A相当）。増分スキャン（mtime/size未変更スキップ・バッチトランザクション）は別タスクへ分離。

内容: (1) 祖先除外（server/src/adapters/real/scanner.ts:293-295）が [...workRoots].filter(...some...) のO(R²)で、30,000候補だと最大約9億比較。パス深さ順ソート+prefix tree/採用済み祖先Setで線形化する。(2) markMissingExcept（workRepo.ts:270）が全seen IDのNOT IN句を生成し、SQLiteのパラメータ上限に接近する。一時テーブル方式に変更する（cleanupとエラー時の状態復元も含む）。

初回の大量取込で一覧API改善以前にスキャンが完了しなくなる恐れがあるため、独立して早期に着手可能。2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 0件・重複パス・祖先子孫混在のケースがテストされている
- [x] #2 markMissingExcept がSQLiteのパラメータ上限に依存しない（一時テーブル方式等）。一時テーブルのcleanupとエラー時の状態復元がある
- [x] #3 pnpm check と pnpm test が通る
- [x] #4 祖先除外の比較回数が線形〜O(N log N)に収まり、数万候補でも実用時間で完了する（二重ループがないことの検証を含む）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. paths.ts に excludeDescendantPaths を追加（深さ昇順ソート+採用済み祖先Setで各候補O(depth)に線形化。計算量検証用のstats任意引数あり）し scanner.ts のO(R^2)filterを置き換え 2. markMissingExcept をTEMPテーブル方式へ変更（DROP IF EXISTS→CREATE→トランザクション内一括INSERT→NOT IN副問合せUPDATE→finallyでDROP） 3. テスト: paths.test.ts に0件/祖先子孫混在/兄弟/区切り境界/計算量、markMissingExcept に数万ID超過・missing化・TEMP cleanup検証を追加 4. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): O(R²)除去・未変更スキップのロジックは継続でOK。DB列追加・スキーマ変更を伴う部分はTASK-71のADR後に新catalogスキーマへ統合推奨。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
祖先除外をexcludeDescendantPaths（深さ昇順+採用済み祖先Set、各候補O(depth)）へ線形化し、markMissingExceptをTEMPテーブル方式へ変更（トランザクション一括INSERT+NOT IN副問合せ、finallyでDROP）。paths.test.tsに7件・markMissingExcept.test.tsに3件追加（4万ID超過・TEMP残存なし・計算量計測）。pnpm check・pnpm test(server193/client273)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
