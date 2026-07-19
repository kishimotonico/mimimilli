---
id: TASK-62
title: スキャンのスケール対策（O(R²)祖先除外・巨大NOT IN・未変更スキップ）
status: To Do
assignee: []
created_date: '2026-07-19 02:03'
updated_date: '2026-07-19 04:07'
labels: []
dependencies: []
priority: high
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
数万作品のスキャンで問題になる箇所の解消。(1) 祖先除外（server/src/adapters/real/scanner.ts:293-295）が [...workRoots].filter(...some...) のO(R²)で、30,000候補だと最大約9億比較。パス深さ順ソート+prefix tree/採用済み祖先Setで線形化する。(2) markMissingExcept（workRepo.ts:270）が全seen IDのNOT IN句を生成し、SQLiteのパラメータ上限に接近する。一時テーブル方式に変更する。(3) mtime/sizeの保存により未変更作品のメタJSON検証・トラック処理をスキップする。(4) DB更新のバッチトランザクション化。

スキャンの非同期ジョブ化・キャンセルはTASK-56（スキャンモーダル・即時実行の廃止）と関連するため、本タスクはスキャン処理自体のスケール対策に限定する。2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 祖先除外がO(R²)でなくなる（数万候補でも実用時間で完了）
- [ ] #2 markMissingExcept がSQLiteのパラメータ上限に依存しない実装になる
- [ ] #3 未変更作品（mtime/size一致）のメタ検証・トラック処理がスキップされる
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): O(R²)除去・未変更スキップのロジックは継続でOK。DB列追加・スキーマ変更を伴う部分はTASK-71のADR後に新catalogスキーマへ統合推奨。
---
<!-- COMMENTS:END -->
