---
id: TASK-529.2
title: ポップオーバーを Ark UI へ置き換え、旧フックを削除し、design-system.md を更新する
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
labels:
  - ui
dependencies:
  - TASK-529.1
parent_task_id: TASK-529
priority: high
ordinal: 650000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
useAnchoredPopover・usePopoverDismissal を使うポップオーバー（約12箇所。GroupValuePopover、FilterChipAddButton、WorkEditTagsField/WorkTagEditor、RegisterFieldsPopover、BarVolumePopover など）を、TASK-529.1 の共通層で Ark のポップオーバーへ置き換える。見た目はメニューと同じ外枠で内側の余白 12px。置き換えの後、usePopoverEscape・useAnchoredPopover・usePopoverDismissal を削除し、使う箇所が無くなった @floating-ui/react の直接依存を外す。docs/design-system.md のメニュー・ポップオーバーのパネルの規定、z-index 表、Motion 節の「復帰は close ハンドラの責務」を ADR-0043 に合わせる。
ADR-0043 の帰結のうち、ポップオーバーの中のメニューで外をクリックしたときの扱いは、このタスクで決める。
関連: ADR-0043、TASK-525、doc-10。見た目の推奨案モック: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ポップオーバーの約12箇所が Ark のポップオーバーになり、見た目がメニューと同じ外枠（内側の余白 12px）になっている
- [ ] #2 軸A→B切替（GroupValuePopover）で、旧Aの復帰が新Bのフォーカスを奪わない。繰り返し測る
- [ ] #3 Esc でメニュー → ポップオーバー → dialog の順に一段ずつ閉じる。IME 変換中の Esc・Enter で閉じも実行もしない
- [ ] #4 ポップオーバーの中のメニューで外をクリックしたときの動作を決め、その動作になっている（決定を ADR-0043 の帰結に反映する）
- [ ] #5 usePopoverEscape・useAnchoredPopover・usePopoverDismissal が無くなり、@floating-ui/react への直接依存が不要なら外れている
- [ ] #6 docs/design-system.md のメニュー・ポップオーバーのパネルの規定、z-index 表、Motion 節が実装と ADR-0043 に一致している
- [ ] #7 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->
