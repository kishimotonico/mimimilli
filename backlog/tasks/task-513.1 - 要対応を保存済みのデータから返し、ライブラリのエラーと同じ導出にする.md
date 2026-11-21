---
id: TASK-513.1
title: 要対応を保存済みのデータから返し、ライブラリのエラーと同じ導出にする
status: Done
assignee: []
created_date: '2026-11-20 10:40'
updated_date: '2026-11-20 11:31'
labels:
  - scan
  - server
dependencies: []
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 589000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「要対応は保存済みのデータから出す」「サーバーの契約」のサーバー側。今は ID重複・読み取り失敗だけがcatalogの診断投影から、アクセス不可・データ不整合・行方不明はメモリの記録（ScanRecordStore）から来るため、再起動で消え、行方不明は新たに起きた分だけでライブラリのエラーと合わない。GET /api/scan/diagnostics が5種類を保存済みのデータから返し、記録（GET /api/scan/last）は完了時刻・新規作品・更新済みだけにする。候補一覧の応答で「起動後まだスキャンが完了していない」と「0件」を区別できるようにする。real・fixture 両adapterで同じ契約を守る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/scan/diagnostics がID重複・読み取り失敗・アクセス不可・データ不整合・行方不明の5種類を返し、サーバー再起動後もスキャンを待たずに同じ内容を返す
- [x] #2 アクセス不可はcatalogの診断投影に保存され、スキャン完了で全置換、中止・失敗では置き換わらない
- [x] #3 行方不明は状態がmissingの作品すべて、データ不整合はライブラリの一覧で dataIntegrityWarning に載る作品と同じ導出で、ライブラリのエラー表示と件数・中身が一致する
- [x] #4 GET /api/scan/last が完了時刻・新規作品・更新済みだけを持ち、未スキャンでは完了時刻が空の記録を200で返す。integrityResolved など不要になった項目が消えている
- [x] #5 候補一覧の応答で、起動後まだスキャンが完了していないことと候補0件を区別できる
- [x] #6 real と fixture の両adapterを通すテストで上の契約を確かめている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
458df7ba で feat/scan-redesign に着地（513.2の上にrebase）。レビュー2周、check/test/smoke全体pass。
<!-- SECTION:NOTES:END -->
