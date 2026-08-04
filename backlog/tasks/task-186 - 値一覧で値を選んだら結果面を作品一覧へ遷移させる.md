---
id: TASK-186
title: 値一覧で値を選んだら結果面を作品一覧へ遷移させる
status: To Do
assignee: []
created_date: '2026-08-04 12:23'
updated_date: '2026-08-04 12:26'
labels: []
dependencies: []
priority: high
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機検証（2026-08-04、TASK-179/180/184/181 の統合検証）で見つかった仕様逸脱。

DRAFT-50 の確定仕様は「値選択 → フィルタチップ追加、結果面が作品一覧へ」だが、現在の実装は値一覧の行・タイルをクリックしてもフィルタチップが増えるだけで、結果面はその軸の値一覧に留まる。作品を見るにはユーザーが「すべての作品」等へ自分で移動する必要があり、値を選ぶ動機（その値の作品を見たい）と噛み合っていない。

ADR-0012 §7 の「クリックで結果面を値一覧ページへ遷移」は軸レールの操作の話であって、値一覧内の行クリックには適用されない。両者を混同しないこと。

なお AND 追加（Ctrl+クリック、ホバー時の追加ボタン）の場合に遷移すべきかは分けて考える。追加操作は絞り込みを積む途中の操作なので値一覧に留まる方が自然。置き換え（通常クリック）のときだけ作品一覧へ遷移させる。

対象: client/src/features/library/ui/AxisValueRows.tsx / AxisValueGrid.tsx / AxisValueList.tsx / libraryNavigationActions.ts / libraryPresentation.ts の computeResultsPaneKind 周辺
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 値一覧の行またはタイルを通常クリックすると、フィルタチップが追加されたうえで結果面が作品一覧へ切り替わる
- [ ] #2 Ctrl+クリックまたはホバー時の追加ボタンによる AND 追加では値一覧に留まり、続けて別の値を積める
- [ ] #3 遷移後に軸レールで同じ軸を選び直すと値一覧へ戻れる
- [ ] #4 ブラウザの戻るで遷移前の値一覧状態へ戻れる
- [ ] #5 上記の分岐が単体テストで検証されている
- [ ] #6 pnpm check と pnpm test が通る
- [ ] #7 置き換えは作品一覧へ進み AND 追加は現在地に留まるという規則が、値一覧だけでなくオーバーレイ類も含む全入口で一貫している（ADR-0012 §8）
<!-- AC:END -->
