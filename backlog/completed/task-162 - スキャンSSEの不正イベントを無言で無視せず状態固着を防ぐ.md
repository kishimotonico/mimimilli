---
id: TASK-162
title: スキャンSSEの不正イベントを無言で無視せず状態固着を防ぐ
status: Done
assignee:
  - '@claude'
created_date: '2026-07-31 00:19'
updated_date: '2026-07-31 02:38'
labels: []
dependencies: []
priority: medium
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-113（DLsite側SSE堅牢化）の調査で発見した残存問題。useScanJob.ts:131-140がJSON解析失敗・schema不一致をreturnで捨てており、terminalイベントが壊れるとscanningがtrueのまま固着しうる。DLsite側（DlsiteBulkRuntime.tsx）で導入した「不正イベントはfail()でエラー表示+active解除」と同じ方針で揃える。接続エラー・POST競合はスキャン側は対処済み。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 不正なSSEイベント（JSON不正・schema不一致）受信時にエラーが利用者に伝わり、scanning状態が固着しない
- [x] #2 既存の正常系・再接続挙動が退行しない（テストで担保）
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
DLsite側（TASK-113）で確立した「不正イベントはエラー表示+状態解除」パターンをuseScanJobへ横展開
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DlsiteBulkRuntimeと同方針で不正イベント時にfail()（エラー表示+detach）。client 454テスト・pnpm check通過。実装Cursor委譲、DLsite側で確立済みパターンの横展開のためCodexレビュー省略。
<!-- SECTION:FINAL_SUMMARY:END -->
