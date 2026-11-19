---
id: TASK-511.4
title: スキャン結果に作品ごとの変化の種類を持たせる
status: To Do
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 00:39'
labels:
  - scan
dependencies:
  - TASK-448.4
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 573000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0034の「スキャン結果は作品ごとに変化の種類を返す」のうち、既存作品の変化の種類をサーバー・sharedで実装する。記録の保持・行方不明・アクセス不可・初回判定はTASK-511.11。既存クライアントの呼び出し元（client/src/features/scan/ui/scanModal/useScanResultWorks.ts・UpdatedWorksTab.tsx）もこのタスクで追随させる（新しい表示はTASK-511.7）。

現状: ScanResult（shared/src/scan.ts）の updatedWorkIds には、移動・作品情報ファイルの変更・メディア差し替え・エラー復帰・全件読み直しが区別なく入る（trackUpsertedWork、server/src/adapters/real/scanRegister.ts）。

決めてあること: 種類は「移動」（旧パス付き）「作品情報」（作品情報ファイルの変更）「ファイル構成」（音声・カバー等の増減や差し替え。音声の増減数付き）の3つ。1作品が複数の種類を持てる。エラーからの復帰や「すべて読み直す」で読み直しただけの作品は変化に入れない。

順序: TASK-448.4（finalizeScanの経路一本化）の後に着手する。変化の種類の判定はスキャンの判断ロジックとしてcoreに抽出し単体テストで縛る（DRAFT-72の「次のスキャン大改修時に実施」をここで扱う。完了時にDRAFT-72の扱いを決める）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 既存作品ごとに、移動（旧パス付き）・作品情報・ファイル構成（音声の増減数付き）の種類を返し、1作品が複数の種類を持てる
- [ ] #2 エラーからの復帰や「すべて読み直す」で読み直しただけの作品は、変化として返らない
- [ ] #3 変化の種類の判定がcoreの関数に抽出され、種類ごとと複合の場合を単体テストで縛っている
- [ ] #4 real/fixture両アダプタで契約を満たし、既存クライアントの呼び出し元が追随していて、pnpm check・pnpm test が通る
<!-- AC:END -->
