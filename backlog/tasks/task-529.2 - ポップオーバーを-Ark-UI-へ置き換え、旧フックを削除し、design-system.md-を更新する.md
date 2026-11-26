---
id: TASK-529.2
title: ポップオーバーを Ark UI へ置き換え、旧フックを削除し、design-system.md を更新する
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
updated_date: '2026-11-26 08:19'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
引き継ぎ資料（会話の文脈なしで読めるように書いてある）
- 参照先: docs/adr/0043-ui-primitives-ark-ui.md（承認）、backlog doc-10（試作の比較）、見た目のモック https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 、試作ブランチ proto/task-525-ark-ui（最新 e10318e99d5dd969dadc3d6dddb4edc27b8f5142。client/src/proto/、完了まで残す）
- 現状のポップオーバーの一覧と、試作で分かった注意（Esc の capture 段、userEvent.click、data-state、backdrop ガード）は TASK-529.1 の実装メモにある
- 軸A→B切替は、試作の ProtoArkAxis.tsx で、ホバーとクリック、復帰の設定の違いを合わせた12通りの奪い合いなしを確認済み。本番の部品でも繰り返し測る

メニューから開いた層（ポップオーバー・ダイアログ）は、閉じたらメニューのトリガーへ戻る。戻し先の解決を層の側の1か所（finalFocusEl 等）にまとめ、RegisterFieldsPopover の Esc で主ボタン→▾と2回 focus する現状を解消する

RegisterFieldsPopover の『N件を追加』で popover が unmount してフォーカスが body に落ち、行が消えたあと隣の行へ移るまで約50ms BODY を経由する（既存の経路）。Ark のポップオーバーへ置き換えるとき、確定ハンドラが移し先へ明示的に移す形にして解消する
<!-- SECTION:NOTES:END -->
