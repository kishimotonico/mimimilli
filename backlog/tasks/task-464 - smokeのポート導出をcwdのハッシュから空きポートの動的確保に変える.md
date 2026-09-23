---
id: TASK-464
title: smokeのポート導出をcwdのハッシュから空きポートの動的確保に変える
status: To Do
assignee: []
created_date: '2026-09-23 22:19'
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
- [ ] #1 smokeのbun/viteサーバーが起動時に空きポートを取得し、cwdのパスからポートを導出しない
- [ ] #2 常駐dev serverが任意のポートを使用中でも、同じマシンでsmokeが衝突せず通る（占有した状態での実行で確認）
- [ ] #3 並列worker（SMOKE_WORKERS）と複数worktreeの同時実行でポートが重ならない
- [ ] #4 derivePort.ts とそのユニットテスト、FORBIDDEN_PORTS の回避ロジックが削除されている
- [ ] #5 pnpm test:smoke が全件通過し、ADR-0020のwait採用（WSL2 loopback）と矛盾しない
<!-- AC:END -->
