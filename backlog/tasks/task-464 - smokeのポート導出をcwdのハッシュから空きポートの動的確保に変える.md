---
id: TASK-464
title: smokeのポート導出をcwdのハッシュから空きポートの動的確保に変える
status: Done
assignee:
  - '@mimi2'
created_date: '2026-09-23 22:19'
updated_date: '2026-10-08 07:33'
labels: []
dependencies: []
ordinal: 518000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/tests/smoke/derivePort.ts はcwdのsha256からbun/viteのポートブロックを決定的に選ぶ。worktreeのパス次第で常駐dev server（bun --watch）と同じポート（実例: .worktrees/feat-source-projection-read → 4836）になり、waitForPortFree が10秒待って失敗し dlsiteBulkApply の smoke が決定的に落ちた（2026-09-24、統合ブランチ最終検証）。別パスのworktreeでは通る。ハッシュ導出は並列worker・複数worktree間の衝突回避が目的だったが、常駐サーバーとの衝突は避けられない。ポートは起動時に空きを確保する方式（port 0 で bind して実ポートを子プロセスの出力から読む等）に変え、cwd依存の決定的導出とforbidden port回避ロジックは廃止する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 smokeのbun/viteサーバーが起動時に空きポートを取得し、cwdのパスからポートを導出しない
- [x] #2 常駐dev serverが任意のポートを使用中でも、同じマシンでsmokeが衝突せず通る（占有した状態での実行で確認）
- [x] #3 並列worker（SMOKE_WORKERS）と複数worktreeの同時実行でポートが重ならない
- [x] #4 derivePort.ts とそのユニットテスト、FORBIDDEN_PORTS の回避ロジックが削除されている
- [x] #5 pnpm test:smoke が全件通過し、ADR-0020のwait採用（WSL2 loopback）と矛盾しない
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
smoke の bun は PORT=0 で起動ログから実ポートを、vite は OS から借りた空きポートを --strictPort で使い、cwd からのポート導出と FORBIDDEN_PORTS を廃止。監督プロセスで、通常終了は子へ SIGTERM を転送し、親の消失時だけグループごと SIGKILL する。ポート占有下・2本同時実行で衝突なし。 個別レビュー＋横断レビュー、master への仮マージで pnpm check・test（server 1031 / client 1335）・smoke 31 全通過。054e2e09 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
