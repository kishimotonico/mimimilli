---
id: TASK-276
title: ScanModalを分割しscan完了後のN+1 getWorkを解消する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies:
  - TASK-210
priority: medium
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/features/scan/ui/ScanModal.tsx（647行）に進捗UI・新規作品リスト・タイトル編集・統計バッジ・footerが同居。ScanModal/ サブディレクトリへ関心別に分割する。
あわせて :126 で scan 完了後に newWorkIds ごとに getWork(id) をN回呼んでいる（Promise.all）。scan結果APIに新規作品のsummaryを含める仕様へ変更し、N+1を解消する（server側の契約変更を含む。shared → fixture → real の順で揃える）。
ScanModalのサーバー状態ローカルコピー解消はTASK-210の担当。先にTASK-210を済ませてから本タスクで分割する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanModal が関心別に分割され、647行の単一ファイルが解消されていること
- [ ] #2 scan結果に新規作品summaryが含まれ、完了後のgetWork N+1が消えていること
- [ ] #3 shared/fixture/real の契約が揃い、server・clientのテストとsmokeが通ること
<!-- AC:END -->
