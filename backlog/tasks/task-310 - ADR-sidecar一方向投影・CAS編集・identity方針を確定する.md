---
id: TASK-310
title: 'ADR: sidecar一方向投影・CAS編集・identity方針を確定する'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:28'
updated_date: '2026-08-13 17:55'
labels: []
dependencies: []
modified_files:
  - docs/adr/0017-meta-source-projection-and-work-identity.md
priority: high
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-55の設計確定部分＋レビュー実施順2。docs/application-architecture-review-2026-08-12.md 優先改善2〜4を正式決定としてADR化する。決定済みの前提（2026-08-12）: 2DB構成は維持（ADR-0008の却下理由は有効）／重複mimimilli.jsonの自動ID再採番は廃止し診断状態化／scan自動登録は候補提示＋一括承認へ置換し、DLsite取得は登録実行時に開始する。ADRに含める内容: source-first書き込み（sourceRevision→409 source_changed、未知フィールド保持patch、atomic replace→単一作品の再投影）とcatalog-first経路の廃止、revisionの3分割（source_revision/projection_revision/media_revision、locationは独立観測値）、移動追従とidentity conflictの期待挙動（レビュー優先改善3の6項目）、mimimilli.jsonへのformatVersion追加、playlists_json二重投影の廃止方針。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/adr/ に上記の決定を網羅するADRが追加されている（番号は作成直前に採番確認）
- [x] #2 2DB維持の判断とADR-0008との関係が明記されている
- [x] #3 重複sidecar発見時の挙動（自動再採番せずidentity_conflict診断）と明示操作による再採番が仕様化されている
- [x] #4 sourceRevision/projection_revision/media_revisionの定義と用途が仕様化されている
- [x] #5 既存データの移行が必要な場合、手動コマンド例がADRに記載されている（自動移行処理は追加しない）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 2026-08-12設計レビュー、TASK-310、既存ADRと現行永続化実装を確認する。
2. sidecar正本・CAS・revision・identity・2DB・移行方針を定めるADRを追加する。
3. 受け入れ条件を確認し、Backlogへ結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ADR-0017を追加。現行のcatalog-first更新、単一fingerprint、routine scanの自動ID修復を確認し、source-first/CAS・3 revision・location分離・identity_conflict・formatVersion・手動移行を仕様化した。

統括レビューを反映。DLsite取得の起点を登録実行時へ修正し、複製側はWork IDのみ再採番、Playlist/Trackのlocal identityとADR-0008・TASK-289との関係を明記した。手動移行は通常名も対象にし、失敗時の一時ファイルcleanupを追加した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ADR-0017でsidecar正本・source-first CAS・revision 3分割・location分離・identity conflict・formatVersion・playlists_json廃止を決定した。scanは未登録候補の承認後に登録し、その登録実行時にDLsite取得を開始する。複製側の明示操作はWork IDのみ再採番する。git diff --checkで差分を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
