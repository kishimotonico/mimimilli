---
id: TASK-115
title: propsのno-op既定値とデッドpropsを廃止する
status: To Do
assignee: []
created_date: '2026-07-27 01:58'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
配線ミスを黙って飲み込む optional props を整理する。

対象:
- TopBar.tsx:57-83 — 24 props のうちコールバック系の既定値が = () => {} の no-op。渡し忘れても無反応で通るため、AGENTS.md の「過度なフォールバック禁止・問題を隠蔽しない」に反する。実際に必須のものは required にする
- AxisColumn.tsx:47-48, 85-86, 106, 118 — viewCounts / facetCounts はどこからも渡されておらず、軸行の件数が常に undefined になるデッド props。既定値の = {} も毎レンダー新オブジェクトを作る。件数表示を実装する予定がなければ削除する
- AddressBar.tsx:8-25 — viewMode / availableViewModes / tileSize / gridLayoutMode を optional にして library / files のモード分岐を表現している。薄い LibraryAddressBar / FilesAddressBar wrapper に分け、共通のナビゲーション部分は共有する（完全な2実装への複製はしない）

TASK-109.1 / 109.3 で AddressBar と TopBar の props は減るので、その後に着手するほうが手戻りが少ない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TopBar のコールバック props に no-op の既定値が残っていない
- [ ] #2 AxisColumn の viewCounts / facetCounts が削除されている（または実際に値が渡されている）
- [ ] #3 AddressBar が library / files のモードを optional props の組み合わせで表現していない
- [ ] #4 アドレスバー・ツールバーの表示と操作が両モードで従来どおり動作する
<!-- AC:END -->
