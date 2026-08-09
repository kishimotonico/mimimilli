---
id: TASK-266
title: scan/dlsiteのSSEジョブランタイムを共通フックへ統合する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
labels: []
dependencies: []
priority: high
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した最大の横断的重複。features/scan/useScanJob.ts と features/dlsite/ui/DlsiteBulkRuntime.tsx:64-256 で、generation token管理・EventSource生成・schema検証・terminal判定・切断時poll・named event購読が約130行規模で構造的に重複している。
- URL構築・イベントschema・terminalコールバックをパラメータ化した useJobEventSource<T> を shared/ に抽出し、両者を載せ替える。invalidate戦略などの差分は呼び出し側に残す
- terminal判定3条件の重複（useScanJob.ts:6-8 / scan/model/atoms.ts:11-13）も isTerminalScanJob として共有する
- useScanJob.ts が model/ 外に置かれている配置も model/ へ揃える
server側のSSEルート重複（routes/scan.ts:94-219 / routes/dlsite.ts:146-172）は仕様差が大きいため対象外（無理な共通化をしない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 共通フックが shared に存在し、scan・dlsite両ランタイムがそれを使うこと
- [ ] #2 terminal判定が1箇所に定義されていること
- [ ] #3 useScanJob が scan/model 配下に配置されていること
- [ ] #4 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
