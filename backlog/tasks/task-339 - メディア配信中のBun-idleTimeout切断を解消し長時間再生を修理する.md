---
id: TASK-339
title: メディア配信中のBun idleTimeout切断を解消し長時間再生を復旧する
status: To Do
assignee: []
created_date: '2026-08-14 10:39'
updated_date: '2026-08-14 10:40'
labels: []
dependencies: []
priority: high
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windowsドッグフーディングで長時間再生（15分前後）すると音声が無音で停止する不具合の根本修正。本番ビルドでも再現済み。

## 根本原因（実測で確定済み・再現調査は不要）
Bun.serveのidleTimeout=90秒（server/src/index.ts:129,140）は「配信中のストリーミング接続」にも適用される（Bun公式ドキュメントに明記）。一方Chromeのメディアローダーは先読みバッファが満ちると接続を保持したまま読み取りを停止する（defer）。この間は無通信なのでBunが90秒で接続を正常FINで閉じる。Content-Length宣言と実送信量が不一致でもHTTPエラーにならないため、ChromeはkErrorを出さずDEMUXER_UNDERFLOW→BUFFERING_HAVE_NOTHINGで永久に固まる。クライアントのstatusはplayingのままresume APIだけが飛び続ける。

## 実測エビデンス（media.tsと同構成のcreateReadStream→Readable.toWeb→Responseで検証済み）
- idleTimeout=5 + 20秒読み取り停止 → サーバーからFIN。67MB中6.4MBで打ち切り
- idleTimeout=0（対照）→ 切断なし、全量受信
- idleTimeout=5 + server.timeout(req, 0) → 切断なし、全量受信（修正方法の有効性確認済み）

## 修正方針
メディア配信ルート（/media/audio, /media/fs-audio。必要なら/media/file, /media/cover も）でリクエスト単位のidle timeoutを無効化する。Bun公式の長寿命ストリーミング対処。
- hono/bun の getBunServer(c) で c.env から Bun Server を取得し server.timeout(c.req.raw, 0) を呼ぶ
- 本リポジトリは Bun.serve({ fetch: app.fetch }) 形式（index.ts:136-141）なので c.env に Bun Server が渡ることを確認済み
- 注意: fixture開発（vite middleware / @hono/node-server getRequestListener 経由）では c.env が {incoming, outgoing} で .timeout() が存在しない。存在チェックでガードすること（TASK-335完了後はこの経路自体が消える）
- index.tsのidleTimeout=90自体はDLsite同期fetch用の設定なので変更しない。数値を上げる案は上限255秒でChromeのdeferを超えるため不採用

## 関連
- ADR-0018（transport統一）。TASK-337のtransport smokeに「defer中の接続維持」回帰テストを載せられる
- 開放端Rangeの上限付き206化は別タスク（このタスクの後続）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実Bun.serve経由で /media/audio を取得中に90秒以上読み取りを停止しても接続が切断されず、再開後に残りのバイトを受信できる（テストで検証）
- [ ] #2 fixture開発経路（@hono/node-server経由）でメディアルートがエラーにならない
- [ ] #3 DLsite同期など他ルートのidleTimeout挙動が変わらない（idleTimeout: 90の設定は維持）
- [ ] #4 pnpm check と server側テストが通る
<!-- AC:END -->
