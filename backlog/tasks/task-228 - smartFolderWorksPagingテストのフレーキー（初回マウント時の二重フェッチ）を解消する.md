---
id: TASK-228
title: smartFolderWorksPagingテストのフレーキー（初回マウント時の二重フェッチ）を解消する
status: To Do
assignee: []
created_date: '2026-08-07 08:41'
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
- [ ] #1 フルスイート並列実行でsmartFolderWorksPaging.test.tsが安定して通る（連続実行で再現しないことを確認）
- [ ] #2 二重フェッチの原因（テスト間干渉かプロダクト挙動か）が特定されタスクノートに記録されている
<!-- AC:END -->
