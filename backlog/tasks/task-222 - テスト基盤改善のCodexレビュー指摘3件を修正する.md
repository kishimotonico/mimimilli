---
id: TASK-222
title: テスト基盤改善のCodexレビュー指摘3件を修正する
status: To Do
assignee: []
created_date: '2026-08-07 05:00'
labels: []
dependencies: []
priority: medium
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
一連のテスト基盤改善（TASK-214/215/221等）へのCodex最終レビューで妥当と判断した3件を修正する。(1) client/playwright.config.ts: ポートハッシュ衝突時、相手サーバーが先に起動済みだとreuseExistingServer: !CIが相乗りする経路が残っている（strictPortは自前起動時のみ有効）。Playwrightは実行後にwebServerを落とすため再利用の実益はなく、reuseExistingServer: falseへ変更して衝突を常に明示的な失敗にする。(2) scripts/dev-real.mjs: worktree専用データディレクトリ名がbasename頼みで、異なる場所の同名worktreeが衝突する。絶対パスの短ハッシュを名前に含めて一意化する。(3) scripts/dev-real.mjs: 子プロセスがシグナル終了した際の再送が自プロセスのリスナーに再捕捉され、終了コード0になりうる。再送前にリスナーを解除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smokeテストのreuseExistingServerがfalseになり、ポート占有時はstrictPortで明示的に失敗する
- [ ] #2 dev-realのworktreeデータディレクトリ名が絶対パス由来の識別子を含み、同名basenameのworktree間で衝突しない
- [ ] #3 dev-realランチャーで子プロセスのシグナル終了が正しく伝搬する（終了コード0にならない）
- [ ] #4 CI=1でのsmoke全件passとpnpm checkが通る
<!-- AC:END -->
