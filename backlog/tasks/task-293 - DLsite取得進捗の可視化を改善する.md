---
id: TASK-293
title: DLsite取得進捗の可視化を改善する
status: To Do
assignee: []
created_date: '2026-08-10 18:59'
labels: []
dependencies: []
priority: medium
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite一括取得の進捗が processed/total の件数のみで、現在処理中の作品が分からず進捗が把握しづらい。サーバーはprogressイベントでworkIdを送っている（shared/src/dlsite.ts:174-186）がクライアントは表示用に保持せず破棄しており（client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx:199-203、dlsiteBulkProgressAtomにworkIdなし）、スナップショット（server/src/dlsiteJobManager.ts:46-62）にもworkIdが含まれないためSSE再接続時に失われる。スキャン進捗はフェーズラベル方式（client/src/entities/scan/model/scanProgressLabel.ts）で分かりやすく、DLsite側もこれとトーンを揃えた表示にする。DLsiteは特に時間のかかる処理なので分かりやすさを重視する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実行中に現在処理中の作品（ID、可能ならタイトル）がUIで確認できる
- [ ] #2 SSE再接続・後乗り（attach）でも現在処理中の作品が表示される（スナップショット拡張）
- [ ] #3 TopBar等の進捗表示がスキャン進捗と一貫したトーンになる
- [ ] #4 pnpm test:smoke で表示を確認する
<!-- AC:END -->
