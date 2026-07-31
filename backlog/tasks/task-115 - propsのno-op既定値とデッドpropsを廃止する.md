---
id: TASK-115
title: propsのno-op既定値とデッドpropsを廃止する
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-27 01:58'
updated_date: '2026-07-31 01:26'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
配線ミスを黙って飲み込む optional props とデッド props を整理する。

現況（2026-07-30 時点、TASK-109 系リファクタ完了後に再確認）:

- TopBar.tsx — 解消済み。TASK-122 / TASK-123 で検索・モード・scan・DLsite の購読がリーフへ降り、props は onOpenScan / onSettings / notificationBell の3つになった。no-op の = () => {} 既定値は残っていない。ただし onOpenScan / onSettings は optional のままなので、required にするかどうかだけ判断が要る
- LeftNav.tsx — 解消済み。TASK-109.4 で playingCount props は廃止され、LeftNav.tsx:22 が playerIsActiveAtom を自身で購読する形になった
- AxisColumn.tsx — 未対応。viewCounts / facetCounts（AxisColumn.tsx:47-48, 85-86）はどこからも渡されておらず、軸行の件数が常に undefined になるデッド props。既定値の = {} も毎レンダー新オブジェクトを作る。件数表示を実装する予定がなければ削除する

よって本タスクの実質的な残作業は AxisColumn のデッド props 削除と、TopBar の optional 2つの扱いの判断。

スコープ縮小の記録（2026-07-27）: 当初は AddressBar の library / files 分離もこのタスクに含めていたが、TASK-109.2 で先に実施済み。AddressBar は props ゼロになり、モード分岐は appModeAtom の購読と LibraryBreadcrumbs / FilesBreadcrumbs / LibrarySortMenu への分解で表現されている。よって AddressBar は本タスクの対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TopBar のコールバック props に no-op の既定値が残っていない
- [ ] #2 AxisColumn の viewCounts / facetCounts が削除されている（または実際に値が渡されている）
- [x] #3 LeftNav の playingCount の扱いが決まっている（required 化・自身で購読・現状維持のいずれか、理由をノートに記録）
- [ ] #4 ツールバー・左ナビの表示と操作が両モードで従来どおり動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. AxisColumnのデッドprops削除
2. TopBarのoptional propsをrequired化
実装Cursor委譲（小規模）
<!-- SECTION:PLAN:END -->
