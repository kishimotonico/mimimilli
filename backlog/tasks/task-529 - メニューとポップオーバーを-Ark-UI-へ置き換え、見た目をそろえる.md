---
id: TASK-529
title: メニューとポップオーバーを Ark UI へ置き換え、見た目をそろえる
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
labels:
  - ui
dependencies: []
priority: high
ordinal: 648000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0043 の置き換え順の2。ボタン起点のメニュー（shared/ui/Menu.tsx の PopupMenu と、role="menu" を手書きした6箇所）と、useAnchoredPopover・usePopoverDismissal を使うポップオーバー（約12箇所）を @ark-ui/react へ置き換え、見た目をモックの推奨案にそろえる。同じ統合ブランチで usePopoverEscape・useAnchoredPopover・usePopoverDismissal を削除して終える。範囲外: 右クリックメニュー（DRAFT-53）、ツールチップ以降の部品、ダイアログ・コンボボックス・トースト（ADR の順で後）、サブメニュー（使う予定が出たら）。
関連: ADR-0043（docs/adr/0043-ui-primitives-ark-ui.md）、TASK-525（試作）、doc-10（試作の比較）、doc-8（右クリック要件）。見た目の推奨案モック: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 。
子タスクで進め、ここでは全体として満たすことを確かめる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 子タスクがすべて完了している
- [ ] #2 Esc がレイヤーごとに一段ずつ閉じる（メニュー、ポップオーバー、dialog、ネイティブ dialog の中のメニューを含む）
- [ ] #3 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->
