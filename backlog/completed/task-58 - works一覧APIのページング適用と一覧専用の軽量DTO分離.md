---
id: TASK-58
title: 一覧専用DTO（WorkListItem）の分離とgetAllWorks依存の整理
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 02:01'
updated_date: '2026-07-22 17:19'
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
- [x] #1 一覧UI・プレビュー・再生開始が軽量DTO移行後も動作する
- [x] #2 通知系フックが getAllWorks() でなく専用APIで判定し、先頭ページだけで件数判定しない
- [x] #3 fixture/real 両アダプタで契約が一致する
- [x] #4 pnpm check と pnpm test が通る
- [x] #5 WorkListItem が shared に定義され、一覧レスポンスに physicalPath・urls・dlsite詳細・プレイリスト詳細を含まない（生HTTPレスポンスのJSONキーを検査するテストで保証。Zod型だけでなく実キー検査）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedにWorkListItemとDLsite通知件数・通知一覧ページのschemaを定義し、WorksPage.itemsをWorkListItemへ変更する 2. real/fixtureは検索・スマートフォルダー評価を既存WorkSummaryで行い、ページング後だけWorkListItemへ投影する。realはcircleName等を一括取得しN+1を避ける 3. DLsite通知の件数APIとRJ未検出・取得失敗のページング一覧APIをadapter/real/fixture/routesへ追加し、通常works一覧への依存をなくす 4. clientの一覧・preview・player境界をWorkListItemへ移行し、通知hooks/modalを専用APIへ変更する。NewWorkPopupはnewWorkIdsの詳細をID指定で取得する 5. fixture/real契約、200件超通知、ページング、生HTTP許可キー、一覧UI・再生開始・通知cache invalidationをテストする 6. pnpm check、pnpm test、必要なブラウザ確認を別検証担当で実行する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-23: 完了済みTASK-73/74/59/75との整合を確認しながら、Codexマルチエージェント運用で引き継ぎ。DTO/API/client/testsを並列調査後、単一実装担当で変更する。

WorkListItemをsharedへ定義し、通常一覧とスマートフォルダー一覧のHTTP itemsを軽量投影へ変更した。real通常一覧は不要なphysicalPath/error/urls/DLsite JSON/全タグを取得・parseせず、ページ対象のcircleNameだけを一括取得する固定クエリ構成。複数サークルタグもUTF-8 BINARY順でfixture/realを統一した。DLsite通知は全件集計APIとRJ未検出・取得失敗のページング一覧APIへ分離し、201件超・fixture/real parityをテスト。NewWorkPopupはID指定詳細取得へ移行しgetAllWorksを廃止した。\n\n検証: pnpm check成功。server 238件、client 298件、visual 6件成功。agent-browser専用sessionで一覧11件、詳細preview、再生UI、通知ベル、DLsite失敗モーダルを確認し、起動後のconsole/page errorなし。実データ保護のため実再生クリックは未実施。
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): shared/API/clientのページング契約は継続でOK。real側のSQL実装はTASK-71のADR(検索所有権の決定)後に。bookmark/lastPlayedの取得実装はDB構成決定と連動。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
一覧専用WorkListItemを導入して重い詳細フィールドをHTTP/real一覧処理から除外し、DLsite通知と新規作品表示の全件取得依存を専用API・ID取得へ置換した。fixture/real契約、大規模通知ページング、一覧・詳細・通知UIを検証した。
<!-- SECTION:FINAL_SUMMARY:END -->
