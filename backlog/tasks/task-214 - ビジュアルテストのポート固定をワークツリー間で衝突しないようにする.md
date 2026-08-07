---
id: TASK-214
title: ビジュアルテストのポート固定をワークツリー間で衝突しないようにする
status: Done
assignee: []
created_date: '2026-08-06 06:13'
updated_date: '2026-08-07 04:10'
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
- [x] #1 複数の worktree で同時に pnpm test:visual を実行しても、互いのサーバーへ相乗りせず独立して完走する
- [x] #2 reuseExistingServer が別ブランチのサーバーへ接続してしまう経路が塞がれている
- [x] #3 単独実行時の挙動と所要時間が従来と変わらない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装（impl-214）: smokePort固定4175を、process.cwd()のsha256から 4200 + (hash % 500) で決定的に導出する方式へ変更（client/playwright.config.tsのみ）。同一worktreeでは常に同一ポートのためreuseExistingServerは自worktree再利用に限定され、strictPort維持でハッシュ衝突時は明確に失敗する。2worktree同時実行で4381/4257（修正前レンジ）に分かれ独立完走を実測確認。レビュー（review-214）指摘1件: 初版レンジ4100〜4599がreal-adapter手動検証用の固定ポート4177を含んでいた → レンジを4200〜4699へ変更して回避（修正後の導出ポート4481で全件pass再確認）。pnpm check全緑。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
smokeテストのポートをworktree絶対パスのsha256から4200〜4699へ決定的に導出する方式へ変更し、worktree間の相乗り経路を構造的に遮断した。予約ポート4175/4177は帯域外。2worktree同時実行の独立完走を実測確認、レビュー指摘（4177衝突リスク）も修正済み。コミット6653452、masterへマージ済み。
<!-- SECTION:FINAL_SUMMARY:END -->
