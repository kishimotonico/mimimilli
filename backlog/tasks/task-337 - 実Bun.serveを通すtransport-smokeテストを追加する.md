---
id: TASK-337
title: 実Bun.serveを通すtransport smokeテストを追加する
status: To Do
assignee: []
created_date: '2026-08-14 10:27'
labels: []
dependencies: []
priority: medium
ordinal: 347000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018の一部。serverテストは現状app.request()レベル（実HTTPソケットなし）のみで、transport層の挙動が自動検証されていない。/api末尾スラッシュ差（5e541a2）やBun idleTimeoutによるDLsite同期fetch切断（TASK-172、6296840）はいずれもtransport層の差異・特性が原因だった。

実ポートへbindしたBun.serveに対してfetchで接続するsmokeテストを追加し、SSE・Range・AbortSignal・shutdownを実HTTPで検証する。fixture adapterを使えばDB・実FSなしで完結する。

TASK-335と独立に着手できる（MIMIMILLI_ADAPTER=fixtureのBun.serve起動は実装済み）。

参照: docs/adr/0018-vite-client-bun-server-separation.md、server/src/index.ts、server/src/routes/media.ts（streamWithRange）、backlog/completed/task-172
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実ポートにbindしたBun.serveへHTTP接続するテストがserverテストに追加され、bun testで実行できる
- [ ] #2 SSEエンドポイントのストリーム受信と、クライアント切断（AbortSignal）でサーバー側ジョブが中断されることを検証する
- [ ] #3 audioのRangeリクエストで206と指定範囲のボディが返ることを検証する
- [ ] #4 graceful shutdown（server.stop→app.shutdown→adapter close→logger dispose）が完了することを検証する
- [ ] #5 /apiと/api/の両方が同じルーティング結果になることを実HTTPで検証する
<!-- AC:END -->
