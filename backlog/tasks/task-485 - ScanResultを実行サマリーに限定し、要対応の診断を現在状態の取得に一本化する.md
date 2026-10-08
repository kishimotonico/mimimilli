---
id: TASK-485
title: ScanResultを実行サマリーに限定し、要対応の診断を現在状態の取得に一本化する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:46'
updated_date: '2026-10-08 05:32'
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
- [x] #1 identityConflictsとinvalidMetaFilesが同じ診断取得経路から得られ、clientの要対応表示はその1経路だけを読む
- [x] #2 スキャン候補の取得経路が1つ
- [x] #3 登録解除・再スキャン後に要対応表示が最新の診断に追従することがテストで確認されている
- [x] #4 ADR-0030・docsの記述が新しい形と一致する
- [x] #5 pnpm check && pnpm test && pnpm test:smoke が通る
- [x] #6 ScanResultが実行結果（件数・その実行で新規登録/更新された作品ID・警告）だけを持ち、現在の診断を持たない
- [x] #7 スキャン画面の新規登録済み・更新済みタブがこれまでどおりその実行の対象作品を表示する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: insertedWorkIds・updatedWorkIds は現在の診断ではなくその実行の結果で、ScanModalの新規登録済み・更新済みタブとscan完了時のDLsite自動取得（ScanJobManager.onCompleted）が使っている。ScanResultに残す。スキャン完了時の自動enqueueの撤去はDRAFT-74の決定事項で、このタスクでは触らない。診断・last resultのqueryOptionsはTASK-475でまとまるので、どちらを先にするか決めてから着手し、両方で別々に取得の共通化をしない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ScanResult を件数・新規/更新作品ID・警告に限定し、ID 重複と不正メタを catalog の診断（invalid_meta_files 新設、migration 0013）として GET /scan/diagnostics に、候補を GET /scan/candidates に一本化。ADR-0030 ほか docs を更新。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージ（衝突解消込み）で pnpm check・test（server 953 / client 1247）・smoke 30 全通過。15013618 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
