---
id: TASK-484
title: ビュー・軸IDの予約語をsharedの1か所から導出する
status: To Do
assignee: []
created_date: '2026-10-02 11:46'
labels:
  - shared
  - client
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 542000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
viewIdSchema（shared/src/library.ts）、RESERVED_AXIS_IDS（shared/src/tagPrefix.ts）、client の VIEW_AXIS_IDS（axisDefinitions.ts）が手書きで並存し、ビューを足すと3箇所の同期が要る。smart- 接頭辞の判定も tagPrefixNameSchema・client の startsWith・navigationUrl.ts に散っている。予約語はビューID定義から導出し、smart- 判定はsharedの1関数にする。軸IDを判別共用体のパーサ型にする案はDRAFT-50の結論後に判断し、このタスクでは扱わない。詳細は doc-6 の shared-1。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 予約軸IDとclientのビュー軸ID一覧がsharedのビューID定義から導出され、手書きの重複リストが無い
- [ ] #2 smart- 接頭辞の判定がsharedの1関数を通る
- [ ] #3 予約語のprefix名を拒否する既存の挙動がテストで縛られている
- [ ] #4 pnpm check && pnpm test が通る
<!-- AC:END -->
