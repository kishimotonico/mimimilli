---
id: TASK-337
title: 実Bun.serveを通すtransport smokeテストを追加する
status: To Do
assignee: []
created_date: '2026-08-14 10:27'
updated_date: '2026-08-14 13:03'
labels: []
dependencies: []
priority: medium
ordinal: 347000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018の一部。serverテストは現状app.request()レベル（実HTTPソケットなし）が中心で、transport層の挙動が体系的に検証されていない。/api末尾スラッシュ差（5e541a2）、Bun idleTimeoutによるDLsite同期fetch切断（TASK-172、6296840）、defer中ストリーミング接続のidleTimeout切断（ADR-0019、TASK-339）はいずれもtransport層の差異・特性が原因だった。

実ポートへbindしたBun.serveに対してfetchで接続するsmokeテストを追加し、SSE・Range・AbortSignal・shutdownを実HTTPで検証する。fixture adapterを使えばDB・実FSなしで完結する。

重複回避: 「defer中の接続維持」（メディアルートのidle timeout無効化）の回帰テストはserver/tests/real/mediaIdleTimeout.test.tsとして実装済み（ADR-0019）。このタスクでは重複させず、未カバーの範囲（SSE・shutdown・末尾スラッシュ・Range応答形式）に集中する。Rangeの検証は開放端bytes=N-が8MiB打ち切り206になる仕様（TASK-340）を前提にする。

限界の明記: fixture adapterのメディアはroutes/media.tsのlocation.type=synthetic経路を通るため、real特有の実ファイルstream＋Rangeの相互作用はこのsmokeでは検証されない。実ファイル経路まで検証する場合は一時ファイル＋real adapter構成が必要で、やるかどうかは実装時に判断し、やらないなら限界としてテストコードに残す。

TASK-335と独立に着手できる（MIMIMILLI_ADAPTER=fixtureのBun.serve起動は実装済み）。

参照: docs/adr/0018-vite-client-bun-server-separation.md、docs/adr/0019-media-streaming-connection-lifetime.md、server/src/index.ts、server/src/routes/media.ts（streamWithRange）、server/tests/real/mediaIdleTimeout.test.ts、backlog/completed/task-172
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実ポートにbindしたBun.serveへHTTP接続するテストがserverテストに追加され、bun testで実行できる
- [ ] #2 SSEエンドポイントのストリーム受信と、クライアント切断（AbortSignal）でサーバー側ジョブが中断されることを検証する
- [ ] #3 audioのRangeリクエストで206と指定範囲のボディが返ることを検証する
- [ ] #4 graceful shutdown（server.stop→app.shutdown→adapter close→logger dispose）が完了することを検証する
- [ ] #5 /apiと/api/の両方が同じルーティング結果になることを実HTTPで検証する
<!-- AC:END -->
