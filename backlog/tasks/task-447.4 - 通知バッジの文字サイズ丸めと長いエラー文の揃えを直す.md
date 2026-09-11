---
id: TASK-447.4
title: 通知バッジの文字サイズ丸めと長いエラー文の揃えを直す
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 472000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 431・428.8 を直す。431 のユーザー理由「誤差1px未満ならいいが、ボタン内フォントサイズが目に見えて大きくなりダサくなった箇所を直す」。原因の一つは TopBar.tsx:216・NotificationBell.tsx:100 の text-[9px]→text-caption(10px) 丸め（tmp/uiux-triage-2026-09-11/gridsize.md）。428.8 のユーザー理由「長いエラーメッセージが中央揃えで2行になるのは日本語で見栄えが悪い」。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tokens.css に --fs-badge（9px）と対応ユーティリティ text-badge が追加され、TopBar.tsx・NotificationBell.tsx のバッジ数字が 9px に戻り、docs/design-system.md のトークン表に1行追加されている
- [ ] #2 431 で移行した箇所の master とブランチの computed font-size を実測して差分をタスクメモに列挙し、ボタン・バッジ内で master より大きくなった箇所は master と同じ px に戻っている（既存トークンで表せない値は統括に相談）
- [ ] #3 起動エラー・セットアップ失敗・通信失敗の画面で、2行以上になるメッセージが左揃えで表示される（メッセージのブロック自体は中央配置のまま）
- [ ] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.4-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.4-after.jpg に置き、タスクメモから参照している
- [ ] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->
