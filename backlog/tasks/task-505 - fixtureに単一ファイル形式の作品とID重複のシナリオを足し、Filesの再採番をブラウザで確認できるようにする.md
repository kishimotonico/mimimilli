---
id: TASK-505
title: fixtureに単一ファイル形式の作品とID重複のシナリオを足し、Filesの再採番をブラウザで確認できるようにする
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-08 05:27'
updated_date: '2026-10-08 07:33'
labels:
  - fixture
  - test
dependencies: []
priority: low
ordinal: 563000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-472 で Files から単一ファイル形式のメタファイル行を再採番できるようにしたが、fixture のシナリオに単一ファイル形式の ID 重複が無く、UI をブラウザ・smoke で確認できない（new-work の診断件数に依存するテストへの波及を避けて追加を見送った）。また fixture の /fs ツリーは単一ファイル形式の作品を d00001 以外載せていない。単一ファイル形式の重複を持つシナリオ（new-work への追加か専用シナリオ）と /fs ツリーへの反映を足し、smoke でメタファイル行の再採番を縛る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 fixture のいずれかのシナリオで、単一ファイル形式の作品の ID 重複が Files にメタファイル行として表示される
- [x] #2 fixture の /fs ツリーに単一ファイル形式の作品の音声ファイルとメタファイルが real と同じ配置で載る
- [x] #3 smoke で、メタファイル行の再採番が成功して親フォルダーが選択されることを確認している
- [x] #4 既存シナリオの件数に依存するテストが壊れていない（pnpm check && pnpm test && pnpm test:smoke が通る）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
server/tests/workPlacementContract.test.ts の「単一ファイル形式のID重複は、対象のメタファイルがFilesの一覧に出る（fixture）」は、fixture がサイドカーの隣に音声ファイルも置くようになり real の place() と同じ配置になったため、期待値を [conflictPathOf("b")] から [conflictPathOf("b"), "b/single.wav"] に増やした。比較を .sort() 後にしたので並び順はこのテストでは見ない（/fs ツリーの並びは fixtureScenarios.test.ts の identity-conflict のテストが縛る）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
fixture に単一ファイル形式の作品 d00002 とその ID 重複を持つ identity-conflict シナリオを足し、/fs ツリーに real と同じ配置で載せた。smoke は worker 単位でシナリオを指定でき、Files のメタファイル行の再採番成功を縛る。 個別レビュー＋横断レビュー、master への仮マージで pnpm check・test（server 1031 / client 1335）・smoke 31 全通過。054e2e09 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
