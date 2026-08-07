---
id: TASK-222
title: テスト基盤改善のCodexレビュー指摘3件を修正する
status: Done
assignee: []
created_date: '2026-08-07 05:00'
updated_date: '2026-08-07 05:07'
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
- [x] #1 smokeテストのreuseExistingServerがfalseになり、ポート占有時はstrictPortで明示的に失敗する
- [x] #2 dev-realのworktreeデータディレクトリ名が絶対パス由来の識別子を含み、同名basenameのworktree間で衝突しない
- [x] #3 dev-realランチャーで子プロセスのシグナル終了が正しく伝搬する（終了コード0にならない）
- [x] #4 CI=1でのsmoke全件passとpnpm checkが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装（impl-222）: (1) reuseExistingServer: false化＋コメント整理。ポート占有状態での実測でstrictPortの明示エラーを確認（相乗りなし）。(2) データディレクトリ名を <basename>-<絶対パスsha256先頭8桁> に一意化（例: task-222-88693cac、実起動ログで確認）。(3) シグナル再送前にリスナー解除、SIGTERMで終了コード143を実測確認。CI=1でsmoke 10件pass、pnpm check全緑。AGENTS.mdのtest:visual記述（Codex指摘4件目）は別作業完了待ちの既知残件として対応せず。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Codex最終レビューで妥当と判断した3件を修正: smokeのreuseExistingServer無効化で相乗り経路を完全遮断、dev-realのworktreeデータディレクトリ名を絶対パスハッシュで一意化、ランチャーのシグナル終了コード伝搬を修正。全件実測検証済み。コミット07002be、masterへマージ済み。
<!-- SECTION:FINAL_SUMMARY:END -->
