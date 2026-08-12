---
id: TASK-310
title: 'ADR: sidecar一方向投影・CAS編集・identity方針を確定する'
status: To Do
assignee: []
created_date: '2026-08-12 11:28'
labels: []
dependencies: []
priority: high
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-55の設計確定部分＋レビュー実施順2。docs/application-architecture-review-2026-08-12.md 優先改善2〜4を正式決定としてADR化する。決定済みの前提（2026-08-12）: 2DB構成は維持（ADR-0008の却下理由は有効）／重複sidecarの自動ID再採番は廃止し診断状態化／scan後のDLsite自動取得連鎖は当面維持。ADRに含める内容: source-first書き込み（sourceRevision→409 source_changed、未知フィールド保持patch、atomic replace→単一作品の再投影）とcatalog-first経路の廃止、revisionの3分割（source_revision/projection_revision/media_revision、locationは独立観測値）、移動追従とidentity conflictの期待挙動（レビュー優先改善3の6項目）、sidecarへのformatVersion追加、playlists_json二重投影の廃止方針。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/adr/ に上記の決定を網羅するADRが追加されている（番号は作成直前に採番確認）
- [ ] #2 2DB維持の判断とADR-0008との関係が明記されている
- [ ] #3 重複sidecar発見時の挙動（自動再採番せずidentity_conflict診断）と明示操作による再採番が仕様化されている
- [ ] #4 sourceRevision/projection_revision/media_revisionの定義と用途が仕様化されている
- [ ] #5 既存データの移行が必要な場合、手動コマンド例がADRに記載されている（自動移行処理は追加しない）
<!-- AC:END -->
