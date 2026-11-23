---
id: TASK-520
title: smoke を同時に2本走らせても互いに落とさない
status: To Do
assignee: []
created_date: '2026-11-23 20:25'
labels:
  - test
dependencies: []
priority: medium
ordinal: 639000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-517〜519 の並行作業中、別の worktree の smoke（playwright）が同時に走ると、CPU 負荷で互いの起動待ち・テスト内の待ちが超過して結果が壊れることが何度も起きた（TASK-518 の計測を汚した）。TASK-518 で起動待ちのタイムアウトは整えたが、同時実行は未検証。ロックで直列化するか、同時に走っても通るようにするかを決めて入れる。Fable の TASK-518 レビュー（統括の scratchpad の review-518-fable.md）の起票案から。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 2つの worktree で同時に pnpm test:smoke を5回ずつ回して全部通る、または直列化の仕組みが入り、同時に起動した2本目が1本目の終了を待ってから走る
- [ ] #2 採った方式と根拠（計測を含む）がタスクのメモにある
- [ ] #3 Windows ネイティブでも動く仕組みになっている（POSIX 前提のロックやシェルに頼らない）
<!-- AC:END -->
