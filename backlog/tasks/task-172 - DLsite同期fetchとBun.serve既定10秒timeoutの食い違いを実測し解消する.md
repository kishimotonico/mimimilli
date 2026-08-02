---
id: TASK-172
title: DLsite同期fetchとBun.serve既定10秒timeoutの食い違いを実測し解消する
status: To Do
assignee: []
created_date: '2026-08-02 06:59'
labels: []
dependencies: []
priority: medium
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計課題（設計方針の詳細3）。POST /dlsite/:id/fetchはキャッシュmiss時に実HTTP完了（リトライ込み最悪60秒＝dlsiteConfig.timeoutMs）までawaitする同期構造だが、Bun.serve(server/src/index.ts:57-61)はidleTimeout未指定で既定10秒。Windows実機ログで「request timed out after 10 seconds」を観測済み。まずBunの10秒がrequest全体/アイドル時間のどちらに効くかを実測し、idleTimeout調整だけで済ませず、長時間処理の非同期ジョブ化（SSE進捗は既存のdlsiteProgress基盤あり）も含めて対応を設計・実装する。クライアント切断時のAbort伝播もあわせて確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bunの既定timeoutの発火条件（request全体かアイドルか）が実測で特定されタスクノートに記録されている
- [ ] #2 キャッシュmissのDLsite取得がBunのtimeoutで失敗しない（同期待ちの解消またはtimeout設計の整合）
- [ ] #3 採用した設計（非同期ジョブ化 or timeout調整の根拠）がタスクノートまたはADRに記録されている
- [ ] #4 pnpm checkとpnpm testが通る
<!-- AC:END -->
