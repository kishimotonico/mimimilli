---
id: TASK-447.15
title: トースト通知を要求キューに一本化し、エラーを最優先で表示する
status: To Do
assignee: []
created_date: '2026-09-11 05:35'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 483000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の A、ユーザー決定「今やる」）。GlobalToast.tsx は toastRequestsAtom＋useToast() の要求キューと、13個の個別 atom の if 連鎖が併存し、variant=error の要求が action 扱いで別の action に負けて未表示のまま消える（design-system.md の規約違反）。全通知を要求キューに寄せ、優先度を error > action > notice > background の4段にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 すべてのトースト通知が toastRequestsAtom（useToast().show）経由で出され、表示専用の個別 atom が削除されている。エラー状態として他でも参照される atom は残り、表示だけ useToast に寄っている
- [ ] #2 優先度が error > action > notice > background の4段で、variant=error の要求は発行元の priority に関わらず最優先で表示され、別の action 要求が来ても未表示のまま破棄されない
- [ ] #3 GlobalToast は要求の集合から1件を選んで Toast に渡すだけになり、onOpenScan 等の画面遷移は各要求の onAction に閉じている
- [ ] #4 同じ文面の再通知で寿命タイマーがリセットされ、古い要求の onDismiss が新しい要求を消さない
- [ ] #5 useTopmostOpenModalDialog の body 全体への MutationObserver が廃止され、開いているモーダル dialog のスタックを useDialogModal 側の状態で管理している
- [ ] #6 docs/design-system.md の単一ホストの優先順位の記述が4段の新契約に置き換わり、globalErrorToast.test 等が新契約で書き直されている（期待値を弱めない）
- [ ] #7 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->
