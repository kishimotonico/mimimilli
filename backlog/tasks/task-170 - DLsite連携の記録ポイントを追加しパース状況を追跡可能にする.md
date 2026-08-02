---
id: TASK-170
title: DLsite連携の記録ポイントを追加しパース状況を追跡可能にする
status: Done
assignee: []
created_date: '2026-08-02 06:59'
updated_date: '2026-08-02 07:33'
labels: []
dependencies:
  - TASK-169
priority: medium
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計方針のフェーズ2。ログ一般方針のDLsiteへの適用。取得ロジックは変えず記録の追加のみ。①parseDlsiteHtml成功時もcircle/cvs/genreTags/coverUrlの欠落フィールドをwarnで記録 ②一括取得ジョブの開始/終了サマリーと作品別の成否・失敗理由をログへ ③dlsite_http系ログにstatus・duration・product codeを付与（DlsiteSchedulerが汎用HTTP層でproduct codeを受け取らない構造のため、呼び出し元からコンテキストを渡せるようlogger引数を拡張）④キャッシュhit/miss判定の理由（TTL/force/expired）を記録 ⑤二次障害ログ(adapters/real/index.ts:1007)もlogger経由に統一。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 パース成功時のフィールド欠落（circle/cvs/genreTags/coverUrl）がwarnログに残る
- [x] #2 一括取得ジョブの開始/終了サマリーと作品別成否・失敗理由がログから追跡できる
- [x] #3 DLsiteのHTTPログにstatus・duration・product codeが含まれる
- [x] #4 キャッシュ判定ログに理由（TTL/force/expired）が含まれる
- [x] #5 pnpm checkとpnpm testが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor委譲で実装、統括レビュー・検証済み。
- listDlsiteMissingFields()(pure)で欠落検出、呼び出し側でdlsite_parse_fields_missingをwarnログ(parse純関数は不変更)
- runDlsiteBulk: ジョブ開始(件数)/終了(サマリー＋所要時間)info、作品別失敗はwarn/error理由付き
- DlsiteScheduler.fetch()に第3引数DlsiteHttpLogContext(productCode/coverUrl/resource)を追加。HTTPログはstatus/durationMs/url付きで完了後に記録、retryにstatus/errorKind付与
- キャッシュ判定理由: hit=ttl_valid/failure_ttl_valid、miss=not_cached/ttl_expired/snapshot_body_missing、force=force_refresh
- DLSITE_EVENT_MESSAGESマップ廃止、resolveDlsiteEvent()のmessage中心構造へ再設計
- 意識的な逸脱: HTTPログにurlを含める(coverはproduct codeから導出不能で診断価値があるため。ローカルログかつ公開URLのみ)
- 検証: pnpm check合格、server 439/client 601テスト全パス
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite取得の記録を拡充: パース欠落warn・一括ジョブの作品別成否とサマリー・HTTPログのstatus/duration/product code・キャッシュ判定理由を追加
<!-- SECTION:FINAL_SUMMARY:END -->
