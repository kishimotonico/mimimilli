---
id: TASK-262
title: server重複ロジックを統一する（defaultPlaylistOf・toWorksPage・共有定数）
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
labels: []
dependencies: []
priority: medium
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した同型ロジックのコピー。
- defaultPlaylistOf が3実装（workRepo.ts:212-229 / scanner.ts:315-321 / fingerprint.ts:152-158）。不正defaultPlaylistId時の挙動も不一致（!例外 / ??null / PersistentDataError）→1実装に統一しエラー方針を明文化
- WorkSummaryPage→WorksPage 投影（toWorkListItem+seed付与）が4箇所コピー（fixture/index.ts:113-122 / real/smartFolderWorks.ts:38-47 / tests 2ファイル）→ toWorksPage を1つ定義
- RECENT_VIEW_WINDOW_DAYS=30 が core/worksQuery.ts:18 と workRepo.ts:165 で重複、乱数seed生成も重複 → sharedへ1箇所化
- routes/dlsite.ts:37-40 の手動kind検証を shared の dlsiteNotificationKindSchema.safeParse に置換
core↔SQLの二重実装自体は契約テストが安全網なので本タスクでは触らない（定数の一元化で乖離リスクだけ下げる）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 defaultPlaylistOf が1実装になり、エラー時の挙動が統一・テストされていること
- [ ] #2 WorksPage投影ヘルパが1つになり4箇所がそれを使うこと
- [ ] #3 RECENT_VIEW_WINDOW_DAYS と乱数seed生成が1箇所で定義されていること
- [ ] #4 dlsite通知kindの検証がsharedスキーマ経由になっていること
- [ ] #5 変更範囲のserverテストが通ること
<!-- AC:END -->
