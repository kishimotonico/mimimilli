---
id: TASK-172
title: DLsite同期fetchとBun.serve既定10秒timeoutの食い違いを実測し解消する
status: Done
assignee: []
created_date: '2026-08-02 06:59'
updated_date: '2026-08-02 09:03'
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
- [x] #1 Bunの既定timeoutの発火条件（request全体かアイドルか）が実測で特定されタスクノートに記録されている
- [x] #2 キャッシュmissのDLsite取得がBunのtimeoutで失敗しない（同期待ちの解消またはtimeout設計の整合）
- [x] #3 採用した設計（非同期ジョブ化 or timeout調整の根拠）がタスクノートまたはADRに記録されている
- [x] #4 pnpm checkとpnpm testが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実測完了(Cursor委譲、Bun 1.3.14、scratchpad/bun-timeout-spike/に再現スクリプトと生ログ)。
- Bunの既定10秒は【アイドル時間】(送受信バイトなし)の制限。request全体の制限ではない
- レスポンス未送信の同期awaitは全期間アイドル扱い→約10秒でクライアント切断(Empty reply)。DLsite fetchの構造がまさに該当、Windows観測と一致
- timeout後もハンドラ処理は継続する(打ち切りではない)。request.signalはabortされるが、現状ルートはsignalをadapterに渡していないためDLsite HTTPは走り続ける
- ストリーミングはチャンク間無通信が10秒超だと途中切断。SSEはheartbeatか間隔保証が必要
- idleTimeout: 30指定で15秒沈黙ケース通過を確認。最大255、0で無効化(ドキュメントと実測一致)
対応オプション: ①idleTimeoutグローバル引き上げ ②server.timeout()個別指定 ③非同期ジョブ化+SSE ④signal配線(切断時のDLsite中断)。設計判断は統括+ユーザーで決定する

実装完了(Cursor委譲、統括レビュー・検証済み)。設計決定: idleTimeout引き上げ＋signal配線(ユーザー承認済み、非同期ジョブ化は見送り)。
- SERVER_IDLE_TIMEOUT_SECONDS=90をBun.serveに指定(DLsite総期限60s＋余裕)
- c.req.raw.signalをdlsiteFetch/dlsiteFetchByCode/dlsiteApply→fetchCachedDlsite→scheduler.fetchのinit.signalまで伝播(schedulerの既存timeoutSignal合成を活用)。クライアント切断でDLsite実HTTPが中断される
- 切断はAbortErrorとして捕捉しdlsiteカテゴリのinfoログ、500にしない
- 一括取得は既存のdlsiteProgress AbortController経由で変更なし、既存テスト通過確認
- 検証: pnpm check合格、server 441/client 603テスト全パス(signal伝播・abort中断テスト2件追加)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bun既定10秒がアイドル制限であることを実測特定し、idleTimeout:90とrequest.signalのadapter〜scheduler配線で解消。クライアント切断時はDLsite取得を中断しinfoログを残す
<!-- SECTION:FINAL_SUMMARY:END -->
