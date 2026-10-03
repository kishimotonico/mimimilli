---
id: TASK-487
title: scanとDLsite一括取得のジョブ追跡をReact外のストアに移し、actionsレジストリを廃止する
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
labels:
  - client
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 545000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
useScanJob.ts はuseRefを8本使ってジョブの世代・終端処理を手書きし、ScanRuntime がuseEffectでhook stateをscanJobAtomへ写している。DlsiteBulkRuntime は jobId/starting/cancelling/progress を別々のatomに持ち、SSE購読をuseEffectの中で行う。scanActionsAtom・dlsiteBulkActionsAtom は「Runtimeコンポーネントがマウント済み」を前提にした関数レジストリで、未マウントだと useScanActions/useDlsiteBulkActions がthrowする。ジョブ追跡（スナップショット・SSE接続・世代管理・終端ハンドラ）を純TSのストアにしてentitiesに置き、start/cancel/attach/resetはストアのメソッドとして直接呼ぶ。scanとDLsiteは同じ形に揃える。プレイヤーの扱いは対象外。詳細は doc-7 の cli-arch-1。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scanとDLsite一括取得のジョブ状態・SSE購読・終端処理がReactコンポーネントの外の同じ形のストアにある
- [ ] #2 操作の呼び出しがRuntimeコンポーネントのマウントに依存せず、actionsレジストリのatomとrequire系の例外が無い
- [ ] #3 ジョブの開始・取消・再接続・終端の遷移がReactを使わない単体テストで縛られている
- [ ] #4 トースト・キャッシュ更新など終端時の副作用が現在と同じタイミングで起きる
- [ ] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
