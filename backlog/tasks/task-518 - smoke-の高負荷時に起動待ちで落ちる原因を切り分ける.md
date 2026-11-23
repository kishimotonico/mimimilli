---
id: TASK-518
title: smoke の高負荷時に起動待ちで落ちる原因を切り分ける
status: To Do
assignee: []
created_date: '2026-11-23 12:50'
labels:
  - test
dependencies: []
priority: medium
ordinal: 631000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm test:smoke を既定の並列で回すと、1回目だけ数本が起動待ちのタイムアウトで落ち、--workers=3 や再実行で通る現象が TASK-516 の間に何度も出た（毎回落ちるテストはばらばら、ベースでは再現しなかったこともある）。ポートの衝突（常駐 dev server・worktree パス由来のポート）、WSL2 の loopback の遅延（ADR-0020）、負荷による起動の遅れのどれかを計測で切り分け、原因に合った直し方を決める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 落ちたときの起動待ちのログ（ポート、待ち時間、その時点の ss -ltnp）が残る仕組みがある
- [ ] #2 既定の並列で10回回した結果と、落ちた原因の内訳がタスクのメモに記録されている
- [ ] #3 原因に対する修正が入り、既定の並列で10回連続して通る。または修正しない判断とその根拠がメモにある
<!-- AC:END -->
