---
id: TASK-261
title: metaIdMigrationのレガシー移行を手動化しスキャン常駐から外す（ADR-0008改訂）
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
labels: []
dependencies: []
priority: high
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査の最重要指摘。server/src/adapters/real/metaIdMigration.ts（598行）が毎スキャンで全 mimimilli.json をread+parseして走る（scanner.ts:478）。実態は「ID無しレガシーメタの一回きり移行」+クラッシュセーフmanifest+テスト専用フック4個（maxWrites・beforeFinalHashCheck・onMetaHash・platform）で、AGENTS.md「一回きり移行はアプリ内に置かない」と矛盾。ADR-0008はスキャン時の重複ID修復を要件として明記しているため、削除にはADR改訂が前提。
方針（統括確定済み）:
- 外部編集による重複ID検出・修復は「移行」ではなく継続的な不変条件維持なので、軽量ガードとしてスキャンに残す
- レガシー defaultPlaylist（名前）→ defaultPlaylistId（UUID）変換、crash-safe manifest機構、テスト専用フックは削除。手動移行手順をADRとコミットメッセージに記載する
- server/tests/real/metaIdMigration.test.ts も残す機能の分だけに縮小する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ADR-0008が改訂され、スキャン時要件が「重複IDガードのみ」に更新されていること
- [ ] #2 レガシー変換・manifest機構・テスト専用フックが削除され、手動移行の手順がADRとコミットメッセージに記載されていること
- [ ] #3 スキャンには軽量な重複ID検出・修復ガードが残り、その挙動がテストで担保されていること
- [ ] #4 移行済みライブラリのスキャンで全メタファイルのハッシュ計算・manifest判定が走らないこと
- [ ] #5 serverテスト全体が通ること
<!-- AC:END -->
