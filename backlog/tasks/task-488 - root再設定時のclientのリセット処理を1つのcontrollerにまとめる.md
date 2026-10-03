---
id: TASK-488
title: root再設定時のclientのリセット処理を1つのcontrollerにまとめる
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
labels:
  - client
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-7
  - docs/adr/0029-root-reconfiguration-workflow.md
priority: medium
ordinal: 546000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
root再設定の突入・離脱時の処理が App.tsx の performReconfigurationEntryReset（再生停止・モーダル閉・DLsite適用ダイアログ閉・scanのreset・navigate・hiddenPaths破棄・epoch更新・stale化）と、ReconfigurationExitEffect・RootReconfigurationDriftEffect・ReconfigurationEntryEffect の3つのEffectコンポーネント、resetLibraryForReconfiguration.ts のキー一覧に分かれている。ExitEffectは「App.tsxはJotaiのread APIをimportしない」というoxlintルールを避けるためだけに分離されている。状態の導出と突入・離脱のリセットを純TSのcontrollerに集約し、リセット対象を1つのリストにする。lintルールが構造を歪めているなら、ルール側を見直す。Runtimeをready時だけマウントする変更は別判断とし、このタスクでは扱わない。詳細は doc-7 の cli-arch-2。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再設定の突入・離脱時にリセットする対象が1箇所に列挙されている
- [ ] #2 lintルールを避けるためだけのEffectコンポーネントが無い
- [ ] #3 突入・離脱・drift検知時のリセットがReactを使わない単体テストで縛られている
- [ ] #4 root再設定の前後で画面・再生・モーダル・キャッシュの状態が現在と同じになることをpnpm test:smokeで確認している
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
