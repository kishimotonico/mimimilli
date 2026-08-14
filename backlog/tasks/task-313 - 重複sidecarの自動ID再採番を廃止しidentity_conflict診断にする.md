---
id: TASK-313
title: 重複sidecarの自動ID再採番を廃止しidentity_conflict診断にする
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:29'
updated_date: '2026-08-13 17:55'
labels: []
dependencies:
  - TASK-310
priority: high
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー優先改善3の一部（2026-08-12決定: 自動再採番の廃止）。現状のduplicateMetaIdRepair.tsは同一Work IDのmimimilli.jsonをパスの自然順で処理し、後から来た側のIDをUUID再採番してmimimilli.jsonへ書き戻す。コピー先のパスが辞書順で先に来ると元作品のidentityが奪われる危険が実在する。scanは正本（mimimilli.json）を自動変更せず、identity_conflictとして診断記録に残すだけにする。競合作品はcatalog上で識別可能な状態にし、解決UI（別作品として取り込む操作）は別タスク。なおTASK-289で対応した同一メタ内のPlaylist/Track ID重複修復は対象外（Work配下のローカルidentityであり危険性が異なる）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scanが重複Work IDを検出してもsidecarのIDを書き換えない
- [x] #2 重複はidentity_conflictとして診断に記録され、サーバーAPIから参照できる
- [x] #3 競合中の作品がcatalogでどう扱われるか（どちらを表示するか等）がADRの仕様どおりに実装されている
- [x] #4 duplicateMetaIdRepairの自動書き換えテストが新仕様のテストに置き換えられている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scan・ID修復・catalog/API契約と既存テストを確認する。\n2. Work ID重複を副作用なしで収集し、catalog診断とAPI契約へ追加する。\n3. 既存投影を保持するowner規則を実装し、重複Workのテストを置き換える。\n4. 受け入れ条件と変更範囲テストを記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Work ID重複を事前収集し、routine scanでは対象sidecarを修復・upsertしないよう変更。catalogのidentity_conflicts投影、GET /api/scan/diagnostics、sharedのScanDiagnostic契約を追加。既存投影はpath順に依存せず保持するテストを追加。変更範囲テスト（32 pass）を実行。

再確認: bun test tests/real/identityConflict.test.ts は2 pass。duplicate sidecar内に同一Playlist IDがあってもscanが一切書き換えないケースを含めた。git diff --checkも成功。

統括レビュー対応: identity_conflictのpathsをroot相対portable pathへ変更し、Playlist/Track IDの自動修復を同一sidecar内だけに限定する。

レビュー対応を完了。diagnostic.pathsはroot相対portable path（例: work-a）に統一し、ADRにはWorkspacePathとして明記。Playlist/Trackの修復は同一sidecar内だけに限定し、作品間重複の旧catalog所有権テストはADRと矛盾するため削除・同一sidecar修復テストへ置換。既存投影を保持し、競合解消後に一意sidecarを再投影するケースも再確認。bun test 対象22 pass、git diff --check成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
identity_conflictをroot相対portable pathでcatalog/APIへ公開し、Work ID競合時はsidecarを書き換えず既存投影を維持する。Playlist/Track IDの自動修復は同一sidecar内だけに限定した。対象テスト22件成功。
<!-- SECTION:FINAL_SUMMARY:END -->
