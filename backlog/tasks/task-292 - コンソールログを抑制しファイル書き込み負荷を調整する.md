---
id: TASK-292
title: コンソールログを抑制しファイル書き込み負荷を調整する
status: In Progress
assignee: []
created_date: '2026-08-10 18:59'
updated_date: '2026-08-10 23:25'
labels: []
dependencies: []
priority: medium
ordinal: 302000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ドッグフーディングで、Webアクセスのたびに「HTTPリクエストを処理しました」がコンソールへ大量に出る問題。現状は全カテゴリ lowestLevel debug で console/file 両sinkに全レベルが流れる（server/src/lib/logger.ts:74-157）。HTTPアクセスログは2xxでも毎回debugで記録される（server/src/app.ts:31-51）。console sinkはinfo以上に制限し、debugはファイル（JSONL）のみに記録する。またfile sinkは@logtape/fileのバッファリング（既定8KB/5秒）だが、200バイト未満のレコードは都度fsyncされるため、通常運用でfsync連発にならないよう設定を調整する。DLsiteの作品ID等の詳細はJSONLのpropertiesに記録済みでコンソール側の改善は不要（確認済み）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 2xxのHTTPアクセスログがコンソールに表示されない
- [x] #2 debugレベルのログがファイル（JSONL）には記録される
- [x] #3 info以上のログは従来どおりコンソールにも表示される
- [x] #4 小サイズレコードの都度fsyncが通常運用で発生しない（バッファリング設定の調整）
- [x] #5 server/tests/appHttpLogging.test.ts を新仕様に合わせて更新する
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
console sinkをwithFilterでinfo以上に絞り、file sinkをgetStreamFileSink（highWaterMark 64KB）へ変更。initLoggerはconfigure()利用のasync関数化し、dispose()でのflush保証を維持。ADR-0011に出力先ポリシーとバッファリング設定を反映。pnpm check通過、pnpm test 541 pass/0 fail。
<!-- SECTION:FINAL_SUMMARY:END -->
