---
id: TASK-155
title: スマートフォルダーの全件DTO化+JS評価を解消する（ルール無し・広い条件のSQL経路化）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 18:44'
labels: []
dependencies: []
priority: high
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
workRepo.ts:645付近・server/src/adapters/real/index.ts:774-782付近。タグ・長さによる候補抽出はSQL化済みだが、resolveSmartFolderCandidateIdsがルール空でnullを返すケースや広いOR/AND条件では、全件近くをDTO化してJSでフィルタ評価・sort・sliceしている。「絞り込み条件なし=並べ替えのみ」のケースをqueryWorksと同じSQLソート/ページング経路へ流す等、全件DTO化を避ける構造にする。ADR-0008の一部見直しを伴う可能性あり。2026-07-31調査第2波S7。DRAFT-25（検索・集計のSQL移行）と関連するが、本タスクはスマートフォルダー経路の全件DTO化解消に限定する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ルール無しスマートフォルダーの表示が全件DTO化+JS評価を経由せず、SQLソート/ページング経路で処理される
- [x] #2 ルール有りの場合も、候補抽出後のDTO化が候補件数分に限定されている（全件DTO化しない）
- [x] #3 スマートフォルダーの表示結果・並び順が変更前と同一（既存の契約テスト+必要な追加テストが通る）
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ルール無しスマートフォルダーをqueryWorksのSQLソート/ページング経路へ
2. ルール有りは候補IDに限定したDTO化へ（全件listSummaries排除）
3. 契約テスト・ベンチ再計測
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ベンチ: ルール無し 343ms→26.5ms(p50, 13倍)。ルール有りは候補限定DTO化のまま209ms（広い候補のさらなる改善はDRAFT-25の派生キーSQL化の領域と判断）。Codexレビュー指摘（契約テストのハンドラ複製）はquerySmartFolderWorks共有関数化で解消。ADR-0008に1文追記。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スマートフォルダー評価をquerySmartFolderWorks()へ集約し、ルール無しはqueryWorksのSQLソート/ページング経路に切替（全件DTO化+JS評価を廃止）。ルール有りはADR-0008の2段構成を維持。本番ハンドラと契約テストが同一関数を共有。343ms→26.5ms。server 364テスト・pnpm check通過。
<!-- SECTION:FINAL_SUMMARY:END -->
