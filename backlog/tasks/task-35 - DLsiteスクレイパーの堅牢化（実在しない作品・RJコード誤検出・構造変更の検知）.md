---
id: TASK-35
title: DLsiteスクレイパーの堅牢化（実在しない作品・RJコード誤検出・構造変更の検知）
status: Done
assignee: []
created_date: '2026-07-10 10:30'
updated_date: '2026-07-11 20:15'
labels: []
dependencies:
  - TASK-34
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite取得の失敗を分類して正しく報告できるようにする。手動UI（TASK-36）のエラーメッセージと一括ジョブ（TASK-37）の状態記録の前提。

## 決定済み仕様（簡素化方針）
エラー分類は3種のみ。判定はHTTPステータスとパース結果検証だけ:
- not_found: HTTP 404（実在しない・販売終了・コード違い）
- parse_error: HTTP 200 だがタイトルが空（DLsiteのHTML構造変更疑い）
- error: 5xx・タイムアウト・ネットワーク断（一時的失敗）

「取得結果とフォルダー名の照合で別作品を警告」ヒューリスティックはやらない（手動UIのプレビューで人間が確認するため）。

## 実装ガイド
- fetchDlsiteInfo の throw を、分類付きの結果型（例 {ok:true, info} | {ok:false, kind: "not_found"|"parse_error"|"error", message}）に変更
- parseDlsiteHtml にタイトル空検証を追加し parse_error とする
- ルート POST /dlsite/:id/fetch は分類をエラーレスポンスに反映（not_found→404、parse_error/error→502等。apiErrorSchemaの形式を維持しつつ、クライアントが分類を判別できる形にする）
- 分類の状態記録（status/error/lastAttemptAtへの書き込み）は取得を起動する側の責務: 手動fetchはプレビューのみで記録しない。記録するのはTASK-37のジョブとapply時
- テスト: parseDlsiteHtml のフィクスチャ（404ページ・空HTML・正常HTML）で3分類を検証。dlsite.ts冒頭の「セレクタの正典はHANDOFF」コメントが実態と不一致なら、正典をコード側コメントに移す
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 404 / タイトル空 / ネットワークエラーが3分類で区別されて返る
- [x] #2 クライアントから分類を判別できるHTTPレスポンスになっている
- [x] #3 parseDlsiteHtmlのフィクスチャテストで3分類をカバー
- [x] #4 pnpm check / pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedにDLsite取得の分類付き結果契約を追加する
2. パーサーのタイトル検証とHTTP・通信失敗の3分類を実装する
3. real/fixtureアダプタとHTTPルートを分類付きレスポンスへ変更する
4. HTMLフィクスチャ中心のテストを追加し、全体検証後に完了・コミットする
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
分類付きDlsiteFetchResultへ統一し、HTTP 404はnot_found、タイトル空はparse_error、5xx・通信例外はerrorとして返す。API error.codeでクライアントが判別できる。検証: pnpm check / pnpm test（server 126件、client 140件）成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite取得を3分類の結果型へ変更し、パーサーのタイトル必須検証、HTTPエラー変換、fixtureとルートの契約を更新した。外部通信なしのHTML・fetchスタブテストで分類を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
