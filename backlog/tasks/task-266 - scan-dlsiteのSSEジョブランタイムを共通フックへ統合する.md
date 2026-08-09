---
id: TASK-266
title: scan/dlsiteのSSEジョブランタイムを共通フックへ統合する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 00:28'
labels: []
dependencies: []
priority: high
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した最大の横断的重複。features/scan/useScanJob.ts と features/dlsite/ui/DlsiteBulkRuntime.tsx:64-256 で、EventSource生成・schema検証・named event購読・close管理・generation token管理が構造的に重複している。
Codexレビュー反映: scanとdlsiteで完全に同型なのはSSE transport層まで（job ownership・poll競合・terminal適用・切断判定の状態機械は仕様が異なる）。高水準の「ジョブランタイム丸ごと共通フック」はコールバック過多になるため作らない。共有するのは型付きtransport（URL・イベントschema・named event購読・close/再接続の骨格）までとし、各runtimeの状態機械は残す。
- terminal判定3条件の重複（useScanJob.ts:6-8 / scan/model/atoms.ts:11-13）は isTerminalScanJob として共有する
- useScanJob.ts が model/ 外に置かれている配置も model/ へ揃える
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 terminal判定が1箇所に定義されていること
- [ ] #2 useScanJob が scan/model 配下に配置されていること
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
- [ ] #4 型付きSSE transport（schema検証・named event購読・close管理）が共有され、scan/dlsite両ランタイムがそれを使うこと（各ジョブの状態機械は独立のまま）
<!-- AC:END -->
