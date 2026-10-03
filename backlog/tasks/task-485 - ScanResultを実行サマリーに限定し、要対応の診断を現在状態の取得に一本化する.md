---
id: TASK-485
title: ScanResultを実行サマリーに限定し、要対応の診断を現在状態の取得に一本化する
status: To Do
assignee: []
created_date: '2026-10-02 11:46'
labels:
  - shared
  - server
  - client
dependencies: []
documentation:
  - backlog/docs/doc-6
  - docs/adr/0030-job-progress-sse-current-state.md
priority: medium
ordinal: 543000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scanResultSchema が実行カウンタに加えて rjCodeMissingCount・identityConflicts・invalidMetaFiles・candidates を持ち、ジョブスナップショット・SSE・GET /scan/last に載る。clientは identityConflicts を GET /scan/diagnostics から、invalidMetaFiles を scanResult から、候補を GET candidates と result.candidates の両方から取っていて、取得元がばらばらで古いスナップショットを表示しやすい。ScanResultは実行サマリー（カウンタと警告）にし、identityConflicts・invalidMetaFiles は現在の診断として1つの取得経路にまとめる。候補は既存の GET candidates に寄せ、result からは外す。詳細は doc-6 の shared-5。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanResultが実行ごとのカウンタと警告だけを持つ
- [ ] #2 identityConflictsとinvalidMetaFilesが同じ診断取得経路から得られ、clientの要対応表示はその1経路だけを読む
- [ ] #3 スキャン候補の取得経路が1つ
- [ ] #4 登録解除・再スキャン後に要対応表示が最新の診断に追従することがテストで確認されている
- [ ] #5 ADR-0030・docsの記述が新しい形と一致する
- [ ] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
