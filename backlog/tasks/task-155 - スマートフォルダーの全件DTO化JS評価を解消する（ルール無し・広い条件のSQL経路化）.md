---
id: TASK-155
title: スマートフォルダーの全件DTO化+JS評価を解消する（ルール無し・広い条件のSQL経路化）
status: To Do
assignee: []
created_date: '2026-07-30 17:53'
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
- [ ] #1 ルール無しスマートフォルダーの表示が全件DTO化+JS評価を経由せず、SQLソート/ページング経路で処理される
- [ ] #2 ルール有りの場合も、候補抽出後のDTO化が候補件数分に限定されている（全件DTO化しない）
- [ ] #3 スマートフォルダーの表示結果・並び順が変更前と同一（既存の契約テスト+必要な追加テストが通る）
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
