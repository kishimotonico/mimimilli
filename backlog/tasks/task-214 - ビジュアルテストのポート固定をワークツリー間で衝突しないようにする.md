---
id: TASK-214
title: ビジュアルテストのポート固定をワークツリー間で衝突しないようにする
status: To Do
assignee: []
created_date: '2026-08-06 06:13'
labels: []
dependencies: []
priority: low
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/playwright.config.ts が visualPort=4175 をハードコードしているため、複数の git worktree で同時に pnpm test:visual を実行すると衝突する。reuseExistingServer が有効な場合、別 worktree で起動しているサーバーへ相乗りしてしまい、そのブランチのコードに対してテストが走る恐れがある。

実際にマルチエージェントで並行検証を行った際に、別 worktree のテストと衝突して全件 ERR_CONNECTION_REFUSED になる事象が複数回発生した。相乗りが起きた場合は「別ブランチのコードをテストして通ってしまう」という、失敗するより厄介な壊れ方になる。

このプロジェクトはタスクを worktree 単位で並行して進めることがあるため、テストインフラ側で衝突を避けられるようにしたい。

方向性: ポートを固定値ではなく空きポートから取得する、あるいはワークツリーのパスから決定的に導出する。reuseExistingServer が意図しないサーバーへ相乗りしないことも確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 複数の worktree で同時に pnpm test:visual を実行しても、互いのサーバーへ相乗りせず独立して完走する
- [ ] #2 reuseExistingServer が別ブランチのサーバーへ接続してしまう経路が塞がれている
- [ ] #3 単独実行時の挙動と所要時間が従来と変わらない
<!-- AC:END -->
