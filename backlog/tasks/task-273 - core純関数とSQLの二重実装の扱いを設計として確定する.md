---
id: TASK-273
title: core純関数とSQLの二重実装の扱いを設計として確定する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
labels: []
dependencies: []
priority: medium
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で最大の技術的負債と判定した構造の設計判断タスク。core/worksQuery・core/axisFacets（インメモリ純関数）と workRepo のSQLが同一仕様の二重実装で、fixture=core・real=SQLという分業になっている。DLsite通知の集計も fixture(in-memory filter) と real(SQL) で二重（dlsiteNotifications.test.ts が同値検証）。
検討する選択肢:
1. 現状維持を正式採用: coreを「実行可能な仕様」と位置づけ、契約テスト（worksQueryContract.test.ts等）による同値担保を設計として明文化する
2. SQLを正としcoreを契約テスト専用に縮小する
3. DLsite通知のようにcore純関数を新設してfixtureが呼ぶ形へ寄せ、二重実装の範囲を統制する
draft-50（ビュー軸とスマートフォルダーの評価経路統合）と関わるため併せて検討し、結論をADRに記録する。決定に伴う実装作業は別タスクとして切り出す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 二重実装の扱い（正とする側・同値担保の方法・新規機能追加時のルール）がADRとして記録されていること
- [ ] #2 DLsite通知集計の core純関数化の要否が決定されていること
- [ ] #3 決定に伴う実装タスクが起票されていること
<!-- AC:END -->
