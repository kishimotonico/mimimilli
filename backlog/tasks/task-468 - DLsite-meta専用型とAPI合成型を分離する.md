---
id: TASK-468
title: DLsite meta専用型とAPI合成型を分離する
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - refactor
  - architecture
  - dlsite
dependencies: []
priority: medium
ordinal: 522000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/architecture-review-2026-09-20.md R6。ADR-0017の区別を契約と型へ反映する改善。

現在のコード根拠:
- shared/src/meta.ts
- shared/src/dlsite.ts（dlsiteStateSchema）
- server/src/adapters/real/dlsiteProjection.ts（toMetaDlsiteState）

metaFileSchemaがAPI向けのdlsiteStateSchemaを使い、error/not_foundや一時的なエラー項目も受理する。toMetaDlsiteStateは同じ型を返しつつ不要項目をnullにし、投影時にstatusを三状態へ読み替えている。型が許す値と正本として有効な値の差が型で守られていない。

決定事項（統括判断、新しいADRに記録する）:
- meta専用の小さな型（rjCode / status: none|applied|skipped / appliedTags）と、cacheと合成したAPI向けの状態は別型にする。
- 既知項目への非対応値は通常読取りで丸めず、診断対象にする。未知の外部ツール用フィールドを保持する方針とは両立する。
- 後方互換は維持しない。既存meta中に残る旧状態値への手動移行コマンド例をADRに残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRでmeta専用型とAPI合成型の分離・非対応値の診断方針・既存meta旧状態値への手動移行コマンド例を記録している
- [ ] #2 shared/src/meta.tsのmetaファイルにおけるdlsite項目の型が、rjCode/status(none/applied/skipped)/appliedTagsのみを許容する専用型になっている
- [ ] #3 server/src/adapters/real/dlsiteProjection.tsのtoMetaDlsiteState等がこの専用型を返し、API向け合成型とは別に定義されている
- [ ] #4 既知項目に非対応の値が読み取り時に見つかった場合、丸めずに診断対象として扱われることがテストで確認されている
- [ ] #5 既存のDLsite関連テストが通り、pnpm check && pnpm test が通る
<!-- AC:END -->
