---
id: TASK-67
title: serverテストの固定ディレクトリをmkdtempの一時ディレクトリへ移行する
status: To Do
assignee: []
created_date: '2026-07-19 03:08'
labels: []
dependencies: []
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘22。server/tests/helpers/sampleLibrary.ts:42 がリポジトリ相対の固定パス（data/test-*）をrmSync→再生成しており、並列テスト・複数worktree・並行セッション（実際に運用中）で衝突する。

対応: mkdtempでテストごとの一時ディレクトリを作り、afterで破棄する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server/tests が data/test-* 固定パスを使わず、テストごとの一時ディレクトリで動く
- [ ] #2 テスト終了時に一時ディレクトリが破棄される
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
