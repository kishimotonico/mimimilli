---
id: TASK-516.18
title: 動作確認のフィードバックを直す（入力欄の自動入力・並べ替えの挿入線）
status: Done
assignee: []
created_date: '2026-11-22 20:57'
updated_date: '2026-11-22 21:06'
labels:
  - library
  - ui
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 619000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-11-23 のユーザーの動作確認のフィードバック。スマートフォルダーの名前の入力欄に 1Password などパスワード管理アプリの自動入力の候補が出る。サイドバーの並べ替えの挿入線（オレンジ）が曲線に見える（行の角丸に inset の box-shadow で線を描いているため。意図したものではない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダーの名前の入力欄に、パスワード管理アプリ（1Password・Bitwarden・LastPass など）とブラウザの自動入力の候補が出ない
- [x] #2 アプリ内の資格情報でないテキスト入力（検索欄・タグ編集など）も同じ扱いで、指定が1か所の部品か共通の属性にまとまっている
- [x] #3 サイドバーの並べ替えの挿入線が、行の角丸に沿わない直線で表示される
- [x] #4 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->
