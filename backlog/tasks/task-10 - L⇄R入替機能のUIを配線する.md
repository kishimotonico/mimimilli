---
id: TASK-10
title: L⇄R入替機能のUIを配線する
status: To Do
assignee: []
created_date: "2026-07-05 17:59"
labels:
  - player
dependencies: []
references:
  - docs/BACKLOG.md
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

チャンネル入替（L⇄R）のエンジン実装（setChannelSwap）は完了済みだが、UIからこの機能を呼び出す導線がまだない。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 プレイヤーUI（バー・ポップアップ・全画面のいずれか適切な場所）にL⇄R入替を切り替えるボタン/トグルを追加する
- [ ] #2 setChannelSwapが呼び出され、実際にチャンネルが入れ替わることをUI操作で確認できる
- [ ] #3 入替中かどうかの状態が視覚的に分かる
<!-- AC:END -->
