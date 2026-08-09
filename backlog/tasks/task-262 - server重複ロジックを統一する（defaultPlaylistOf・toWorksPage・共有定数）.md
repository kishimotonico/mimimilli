---
id: TASK-262
title: server重複ロジックを統一する（defaultPlaylistOf・toWorksPage・共有定数）
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
updated_date: '2026-08-09 01:32'
labels: []
dependencies: []
priority: medium
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した同型ロジックのコピー。
- defaultPlaylistOf が3実装（workRepo.ts:212-229 / scanner.ts:315-321 / fingerprint.ts:152-158）。Codexレビュー反映: 各実装のエラー契約は層ごとに意味が異なる（schema境界とDB境界）ため、共有するのはnullableな純粋選択ロジックのみとし、エラー変換は各層に残す
- WorkSummaryPage→WorksPage 投影が4箇所コピー。Codexレビュー反映: 共通化は本番2箇所（fixture/index.ts:113-122 / real/smartFolderWorks.ts:38-47）のみ。テストの期待値生成まで共通ヘルパを使うと契約テストが本番実装を自己参照するため、テスト側は独立に組み立てたままにする
- RECENT_VIEW_WINDOW_DAYS=30 が core/worksQuery.ts:18 と workRepo.ts:165 で重複、乱数seed生成も重複 → sharedへ1箇所化
- routes/dlsite.ts:37-40 の手動kind検証を shared の dlsiteNotificationKindSchema.safeParse に置換
core↔SQLの二重実装自体はTASK-273（ADR適合監査）の管轄。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 RECENT_VIEW_WINDOW_DAYS と乱数seed生成が1箇所で定義されていること
- [ ] #2 dlsite通知kindの検証がsharedスキーマ経由になっていること
- [ ] #3 変更範囲のserverテストが通ること
- [ ] #4 defaultPlaylistOf の純粋な選択ロジックが1実装になり、schema境界・DB境界のエラー変換は各層に残す形で整理されていること
- [ ] #5 本番2箇所のWorksPage投影が共通ヘルパを使い、テストの期待値生成は独立のままであること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-273（ADR適合監査）からの統合: DLsite通知述語の core化。shared/src/dlsite.ts:33-46 の isRjCodeMissing・isDlsiteFetchFailed が「正典」と明記されているのに、workRepo.ts:958-991 の getDlsiteNotificationSummary が参照コメントすら無くSQLのCASE式で独立再実装している（fixture/index.ts:427,447-448 は正典を直接呼んでいる）。ADR-0004のcore-first規範に照らし、これはSQL性能例外として追認せず core純関数化して fixture が呼ぶ形へ寄せる。realはSQL維持でよいが、既存の dlsiteNotifications.test.ts と worksQueryContract.test.ts:260-309 で同値担保すること。
<!-- SECTION:NOTES:END -->
