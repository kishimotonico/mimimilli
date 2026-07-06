---
id: TASK-5
title: タグ追加ポップオーバーの幅と展開方向を改善する
status: To Do
assignee: []
created_date: "2026-07-05 17:59"
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

タグ追加ポップオーバーが右ペイン内で右端に寄り、入力欄と候補リストの横幅が狭く見える。短いタグでは問題ないが、構造化タグや長い日本語タグを入力すると読みづらくなる。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ポップオーバーの最小幅を広げる
- [ ] #2 右端に寄る場合は左方向へ展開するようにする
- [ ] #3 候補行はタグ名と補足情報の優先順位を明確にし、長い値は中略+tooltip表示にする
- [ ] #4 右ペイン幅が一定以下の場合、タグ追加UIをチップ列下のフル幅行として展開する
<!-- AC:END -->
