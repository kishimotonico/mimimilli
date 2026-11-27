---
id: TASK-529
title: メニューとポップオーバーを Ark UI へ置き換え、見た目をそろえる
status: Done
assignee: []
created_date: '2026-11-26 03:15'
updated_date: '2026-11-27 13:57'
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
- [x] #1 子タスクがすべて完了している
- [x] #2 Esc がレイヤーごとに一段ずつ閉じる（メニュー、ポップオーバー、dialog、ネイティブ dialog の中のメニューを含む）
- [x] #3 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括の引き継ぎ（2026-11-26）
- 状態: TASK-529.1 は Done。実装は統合ブランチ feat/task-529-ark-ui（9f774ff6、master から17コミット）。TASK-529.2 は設計まで合意済み（doc-11）で、実装は未着手。作業ブランチ task-529.2-ark-popover（worktree .worktrees/task-529.2、9f774ff6 から分岐）。実装の進め方は TASK-529.2 の実装メモにある（Claude 以外のエージェントでも読める形）
- 529.2 の実装が終わったら: 作業ブランチを統合ブランチへ fast-forward で集約し、統合ブランチ全体（master..feat/task-529-ark-ui）の最終レビューを Claude で行う。そのうえで親の AC2・AC3（Esc の段の総合確認、pnpm check && pnpm test と pnpm test:smoke）を確かめる。master への --no-ff マージはユーザーの返事を待つ
- 後片付け: TASK-529.1 の worktree .worktrees/task-529.1、.worktrees/task-529.1-fix、.worktrees/task-529.1-fix2（ブランチ task-529.1-ark-menu・task-529.1-fix・task-529.1-fix2。いずれも統合ブランチに取り込み済み）は不要。試作ブランチ proto/task-525-ark-ui と worktree .worktrees/task-525-ark-ui は TASK-529 の完了まで残す
- 関連: TASK-530（@ark-ui/react を 5.40.1 へ。2026-11-30 以降に着手可）、TASK-528

DRAFT-53（右クリックメニュー）で先に直すこと（2026-11-27 最終レビューより）: shared/ui/menu/MotionMenu.tsx の findLayerTrigger は aria-controls 頼みで、ContextTrigger は aria-controls を出さないため、dialog の中の右クリックメニューは body へポータルされて inert になる。shared/ui/layer/focusReturnTarget.ts は aria-labelledby からトリガーを引くため、右クリックメニューでは null になり、MenuLayerItem から開いたダイアログの戻し先が無くなる。

同じ理由（findLayerTrigger が aria-controls 頼み）で、右クリックメニューではスクロールで閉じる監視も効かない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
メニュー8か所・ポップオーバー8か所を @ark-ui/react 5.40.0 へ置き換え、旧フックと @floating-ui/react を外した（529.1・529.2）。統合ブランチの最終レビュー（doc-12）を受けて共通層と呼び出し側を整理した（529.3・529.4）。Esc の段は smoke（popoverMenu・作品編集のタグ追加・未登録のダイアログ内メニュー）で確認。check・test・smoke（76）成功、Fable の最終レビューで must なし。master へ 2df288d8 でマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
