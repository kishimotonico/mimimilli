---
id: TASK-5
title: タグ追加ポップオーバーの幅と展開方向を改善する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 09:48'
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
- [x] #1 ポップオーバーの最小幅を広げる
- [x] #2 右端に寄る場合は左方向へ展開するようにする
- [x] #3 候補行はタグ名と補足情報の優先順位を明確にし、長い値は中略+tooltip表示にする
- [x] #4 右ペイン幅が一定以下の場合、タグ追加UIをチップ列下のフル幅行として展開する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェントがセッション制限で中断（途中差分あり・tsc通過状態）。Codexへ引き継ぎ、残実装を委譲。

Codexが引き継ぎ完成、Fable検証: 広ペイン(732px)で260pxポップオーバーがペイン内にクランプ、狭ペイン(516px)ではチップ列下のフル幅行へ自動切替（ResizeObserver）。コミット 4f5cb51。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグ追加UIを適応レイアウト化（260px幅・ペイン内クランプ・狭幅はフル幅行）、候補行はタグ名優先+中略tooltip。
<!-- SECTION:FINAL_SUMMARY:END -->
