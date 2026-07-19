---
id: TASK-58
title: 一覧専用DTO（WorkListItem）の分離とgetAllWorks依存の整理
status: To Do
assignee: []
created_date: '2026-07-19 02:01'
updated_date: '2026-07-19 04:26'
labels: []
dependencies: []
priority: high
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）により旧TASK-58を3分割した1つ目（58A相当）。ページング適用は TASK-73（通常works）・TASK-74（スマートフォルダー）へ分離し、本タスクはDTO分離と全件取得依存の整理のみを扱う。

内容: 一覧専用の軽量DTO WorkListItem（id/title/coverImage/status/totalDurationSec/trackCount/bookmarked/lastPlayedAt/circleName等）を shared に定義し、real/fixture両アダプタでDTO生成。一覧UI・プレビュー・再生開始コールバック（App.tsx:140 / WorkGrid.tsx:41 / ContentColumn.tsx:17 / usePlayer.ts:86 がWorkSummary前提）を型移行。サークル表示は全タグを渡さず circleName を投影。

重要な退行リスク: 通知系フック（client/src/features/.../dlsiteMissingRjCode.ts:19・dlsiteFetchFailed.ts:19・dlsiteUnlinked.ts:16、entities/work/api.ts:37）が getAllWorks() で全件取得して dlsite 状態を判定している。一覧DTOから dlsite を外すと壊れ、将来デフォルトlimitが入ると先頭ページだけで判定して件数が誤る。これらは専用API（RJコード未検出/DLsite取得失敗/未連携の件数・一覧）へ移行する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 一覧UI・プレビュー・再生開始が軽量DTO移行後も動作する
- [ ] #2 通知系フックが getAllWorks() でなく専用APIで判定し、先頭ページだけで件数判定しない
- [ ] #3 fixture/real 両アダプタで契約が一致する
- [ ] #4 pnpm check と pnpm test が通る
- [ ] #5 WorkListItem が shared に定義され、一覧レスポンスに physicalPath・urls・dlsite詳細・プレイリスト詳細を含まない（生HTTPレスポンスのJSONキーを検査するテストで保証。Zod型だけでなく実キー検査）
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): shared/API/clientのページング契約は継続でOK。real側のSQL実装はTASK-71のADR(検索所有権の決定)後に。bookmark/lastPlayedの取得実装はDB構成決定と連動。
---
<!-- COMMENTS:END -->
