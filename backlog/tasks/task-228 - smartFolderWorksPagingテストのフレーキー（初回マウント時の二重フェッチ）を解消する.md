---
id: TASK-228
title: smartFolderWorksPagingテストのフレーキー（初回マウント時の二重フェッチ）を解消する
status: Done
assignee: []
created_date: '2026-08-07 08:41'
updated_date: '2026-08-11 10:52'
labels: []
dependencies: []
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/tests/unit/smartFolderWorksPaging.test.ts の「フィルタが変わるとクエリキーが変わり、別クエリとしてフェッチし直す（キャッシュ分離）」が、フルスイート並列実行時にまれに落ちる（2026-08-07にmaster f640960で観測。初回マウント時点で期待1件のところ2件のスマートフォルダーフェッチが発生し、tests/unit/smartFolderWorksPaging.test.ts:258 で失敗）。単体実行5回・フルスイート再実行では再現せず、決定的退行ではない。テスト間でのfetchMock/クエリキャッシュの状態共有やタイミング競合が疑わしい。原因を特定し、テストを決定的にする（プロダクトコード側の二重フェッチの実在も確認し、実害があればそちらも直す）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フルスイート並列実行でsmartFolderWorksPaging.test.tsが安定して通る（連続実行で再現しないことを確認）
- [x] #2 二重フェッチの原因（テスト間干渉かプロダクト挙動か）が特定されタスクノートに記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
原因はテスト側のアサーションのタイミング競合で、プロダクトコードの二重フェッチは実在しなかった。useSuspenseSmartLibraryWorks を同一条件で50回マウント（StrictModeあり/なし）してもスマートフォルダーの /works フェッチは常に1回。旧テストは works.length > 0 だけ待って累計フェッチ数を即座に1と断定しており、Suspense + infinite query ではデータ表示とfetch記録のタイミングがずれる余地があるため、負荷下で2件記録済みになることがあった。初回フェッチ完了を待って mockClear し、フィルタ変更で発生する1回だけを検証する形へ変更（librarySearchDebounce.test.ts と同じ構え）。検証: 対象テスト単体20〜30回、関連5ファイル並列10回、フルスイート pnpm test 3連続すべて通過（794 tests / 103 files）。pnpm check 通過。ブランチ feat/task-228-flaky-smartfolder-paging（101d793）。派生でTASK-306を起票。
<!-- SECTION:NOTES:END -->
