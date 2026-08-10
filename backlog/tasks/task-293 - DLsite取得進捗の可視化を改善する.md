---
id: TASK-293
title: DLsite取得進捗の可視化を改善する
status: Done
assignee: []
created_date: '2026-08-10 18:59'
updated_date: '2026-08-10 23:32'
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
- [x] #1 実行中に現在処理中の作品（ID、可能ならタイトル）がUIで確認できる
- [x] #2 SSE再接続・後乗り（attach）でも現在処理中の作品が表示される（スナップショット拡張）
- [x] #3 TopBar等の進捗表示がスキャン進捗と一貫したトーンになる
- [x] #4 pnpm test:smoke で表示を確認する
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite一括取得のprogressイベントをworkIdからwork{id,rjCode,title}へ拡張し、ジョブスナップショットにも含めることでSSE再接続・attach後も現在処理中の作品が復元されるようにした。TopBarはスキャン進捗と同じトーンで「DLsiteから取得中 (n/total) — 作品名」を表示（タイトル空ならRJ番号、長いタイトルはtruncate）。pnpm check通過、pnpm test server 540 / client 794 pass、pnpm test:smoke 10 passed。
<!-- SECTION:FINAL_SUMMARY:END -->
