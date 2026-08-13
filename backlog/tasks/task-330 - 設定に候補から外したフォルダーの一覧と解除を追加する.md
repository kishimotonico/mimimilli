---
id: TASK-330
title: 設定に候補から外したフォルダーの一覧と解除を追加する
status: To Do
assignee: []
created_date: '2026-08-13 16:59'
labels: []
dependencies:
  - TASK-327
priority: medium
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14。候補から外す操作はuser DBへ永続化されるが解除するUIがどこにもなく、実質的に取り消せない。TASK-327で直後の取り消し（トーストの「元に戻す」）は用意するが、後から気づいた場合の救済手段がない。設定画面に一覧と解除を置く。UI仕様: 設定モーダルにセクションを追加し、外したフォルダーのパス一覧を表示／各行に解除ボタン／解除すると次回スキャンから候補として再び提示される／0件のときはセクションごと非表示にせず「候補から外したフォルダーはありません」と表示する（機能の存在を知らせるため）。デザインはdocs/design-system.md準拠。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 設定画面で候補から外したフォルダーの一覧を確認できる
- [ ] #2 各行から解除でき、解除後の次回スキャンで候補として再び提示される
- [ ] #3 0件のときも案内文とともにセクションが表示される
- [ ] #4 pnpm test:smokeが通る
<!-- AC:END -->
