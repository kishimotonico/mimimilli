---
id: TASK-276
title: ScanModalを分割しscan完了後のN+1 getWorkを解消する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 14:56'
labels: []
dependencies:
  - TASK-210
priority: medium
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。client/src/features/scan/ui/ScanModal.tsx（647行）に進捗UI・新規作品リスト・タイトル編集・統計バッジ・footerが同居。ScanModal/ サブディレクトリへ関心別に分割する。
あわせて :126 で scan 完了後に newWorkIds ごとに getWork(id) をN回呼んでいる。scan結果契約に新規作品のsummaryを含める仕様へ変更し、N+1を解消する（shared → fixture → real の順で揃える）。
Codexレビュー反映:
- TASK-210（サーバー状態ローカルコピー解消）を先に単独実施すると、N件getWorkをuseQueriesへ載せ替えた直後に本タスクで取得経路ごと廃止する手戻りになる。両タスクは同一worktreeで統合実施し、最初からscan結果契約の拡張で解決する（統括が実施時に調整）
- 契約変更の範囲を明確にする: ScanResult はSSE・last snapshot・DLsite enqueueにも共用されている（shared/src/scan.ts:64-75,92-97 / scanJobManager.ts:187-202）。summaryを載せる位置、newWorkIds の存廃、SSE/lastの契約テストまで含めて設計する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanModal が関心別に分割され、647行の単一ファイルが解消されていること
- [ ] #2 shared/fixture/real の契約が揃い、server・clientのテストとsmokeが通ること
- [ ] #3 scan完了後の作品別getWork呼び出しが0回であること
- [ ] #4 scan結果契約は新規作品のIDのみを持ち、表示用の作品情報は works API から一括取得している（イベント記録に表示用データを埋め込まない）
<!-- AC:END -->
