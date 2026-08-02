---
id: TASK-170
title: DLsite連携の記録ポイントを追加しパース状況を追跡可能にする
status: To Do
assignee: []
created_date: '2026-08-02 06:59'
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
- [ ] #1 パース成功時のフィールド欠落（circle/cvs/genreTags/coverUrl）がwarnログに残る
- [ ] #2 一括取得ジョブの開始/終了サマリーと作品別成否・失敗理由がログから追跡できる
- [ ] #3 DLsiteのHTTPログにstatus・duration・product codeが含まれる
- [ ] #4 キャッシュ判定ログに理由（TTL/force/expired）が含まれる
- [ ] #5 pnpm checkとpnpm testが通る
<!-- AC:END -->
