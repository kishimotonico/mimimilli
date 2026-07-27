---
id: TASK-115
title: propsのno-op既定値とデッドpropsを廃止する
status: To Do
assignee: []
created_date: '2026-07-27 01:58'
updated_date: '2026-07-27 11:09'
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

対象:
- TopBar.tsx — 24 props のうちコールバック系の既定値が = () => {} の no-op。渡し忘れても無反応で通るため、AGENTS.md の「過度なフォールバック禁止・問題を隠蔽しない」に反する。実際に必須のものは required にする
- AxisColumn.tsx — viewCounts / facetCounts はどこからも渡されておらず、軸行の件数が常に undefined になるデッド props。既定値の = {} も毎レンダー新オブジェクトを作る。件数表示を実装する予定がなければ削除する
- LeftNav.tsx — playingCount が optional（既定値0）。TASK-109.4 でプレイヤー state の購読を降ろすときに required にするか自身で購読するかを併せて判断する

着手順: TASK-109.3 で TopBar から通知関連の props が消えるので、その後に着手するほうが手戻りが少い。

スコープ縮小の記録（2026-07-27）: 当初は AddressBar の library / files 分離もこのタスクに含めていたが、TASK-109.2 で先に実施済み。AddressBar は props ゼロになり、モード分岐は appModeAtom の購読と LibraryBreadcrumbs / FilesBreadcrumbs / LibrarySortMenu への分解で表現されている。よって AddressBar は本タスクの対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TopBar のコールバック props に no-op の既定値が残っていない
- [ ] #2 AxisColumn の viewCounts / facetCounts が削除されている（または実際に値が渡されている）
- [ ] #3 LeftNav の playingCount の扱いが決まっている（required 化・自身で購読・現状維持のいずれか、理由をノートに記録）
- [ ] #4 ツールバー・左ナビの表示と操作が両モードで従来どおり動作する
<!-- AC:END -->
