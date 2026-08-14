---
id: TASK-314
title: scanのpublishを単一transaction化しrevision3分割を導入する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:30'
updated_date: '2026-08-13 17:55'
labels: []
dependencies:
  - TASK-310
  - TASK-311
priority: medium
ordinal: 324000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善4・5のserver側部分。現状はScanUpsertBatchが500件ごとに公開catalogへ即commitし、キャンセル・失敗時に新旧世代が混在する。missing確定は最後のfinalizePhaseのみ。I/Oとparse（JSON検証・media stat・duration probe）はtransaction外のstagingで行い、完成した差分だけを短いtransactionで公開する。読み取れなかったsubtreeはmissingへ落とさずunverifiedとして旧投影を維持し、scan中にmimimilli.jsonが変わった作品は今回のpublishから外す。fingerprintはADRのrevision3分割（source/projection/media、locationは独立観測値）に置き換える。スコープ外: 自動登録の見直し（TASK-166）、Review UI、scan後のDLsite自動連鎖は現状維持（2026-08-12決定）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scanの公開catalog反映が世代単位の短いtransactionで行われ、500件ごとの逐次commitが廃止されている
- [x] #2 scanのキャンセル・失敗時に公開catalogへ新世代が部分反映されない
- [x] #3 読み取れなかったsubtreeの作品がmissingにならずunverifiedとして旧投影を維持する
- [x] #4 fingerprintがsource_revision/projection_revision/media_revisionへ分割され、locationがrevisionに含まれない
- [x] #5 キャンセル・途中失敗・unverified・移動検知のテストがある
- [x] #6 DLsite自動取得の起点が「scan完了時のnewWorkIds」から「登録実行時」へ移り、登録済み作品の取得が従来どおり動作する（TASK-318と整合）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 既存scan・catalog schema・DLsite起点とテストを調査する。 2. scanをtransaction外stagingと単一transaction publishへ再設計し、revision/location/unverifiedを導入する。 3. 登録APIにDLsite enqueue用の公開境界を用意してscan完了起点を除去する。 4. 対象テストを追加・更新し、受け入れ条件を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
scanの投影・診断・presenceを最後のcatalog transactionへ集約し、publish直前のsource revision再検証、unverified保持、revision3分割と登録APIのDLsite enqueue hookを実装。対象テストを更新・追加した。検証担当による実行確認待ち。

検証: pnpm --filter shared check、pnpm --filter server check、bun test tests/real/scanner.test.ts（31 pass）、git diff --check が成功。fmt:check は既存の無関係な21ファイルの整形不備で失敗したが、本タスクの変更ファイルは oxfmt 済み。統合branchではTASK-312がmigration 0011を先行利用しているため、統合時に0011_scan_revisionsを0012へ採番し、journal/snapshotを再生成すること。

レビュー修正: single-work publishをpublishWork、scan世代の投影・diagnostics・presence更新をpublishScanGenerationへ分離。single-work再投影が他作品status/identity conflictを保持する回帰テストを追加。projection revisionを明示した投影入力だけへ限定し、DLsite一時状態を除外。2DBのためuser transaction後のcatalog失敗ではorphan user stateが残り得るが、public catalogはcatalog transactionで原子的に維持する。再検証: scanner 32 pass、shared/server check、diff check成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scan世代publishと単一作品publishを分離し、単一作品の編集・登録・復元が他作品presenceやidentity diagnosticsを変更しないようにした。revision3分割、source再検証、unverified保持、登録起点DLsite enqueueを実装。scanner 32 testsとshared/server typecheck、diff checkを確認済み。
<!-- SECTION:FINAL_SUMMARY:END -->
