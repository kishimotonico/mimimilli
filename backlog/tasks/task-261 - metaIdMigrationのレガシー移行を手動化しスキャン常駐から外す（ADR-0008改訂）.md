---
id: TASK-261
title: metaIdMigrationのレガシー移行を手動化しスキャン常駐から外す（ADR-0008改訂）
status: To Do
assignee: []
created_date: '2026-08-08 21:17'
updated_date: '2026-08-09 00:26'
labels: []
dependencies: []
priority: high
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査の最重要指摘。server/src/adapters/real/metaIdMigration.ts（598行）が毎スキャンで走る（scanner.ts:478）。実態は「ID無しレガシーメタの一回きり移行」+クラッシュセーフmanifest+テスト専用フック4個で、AGENTS.md「移行処理を書かない」と矛盾。ADR-0008はスキャン時の重複ID修復を要件として明記しているため、削除にはADR改訂が前提。
方針（統括確定・Codexレビュー反映）:
- 外部編集による重複ID検出・修復は継続的な不変条件維持としてスキャンに残す。ただし単にmanifestを剥がすのではなく、残す修復の保全要件（Work/Playlist/Track全ID種の扱い・原子的書込み・外部編集競合・失敗時復旧）をADR-0008で再定義する
- レガシー defaultPlaylist（名前）→ defaultPlaylistId（UUID）変換、crash-safe manifest機構、テスト専用フック（maxWrites・beforeFinalHashCheck・onMetaHash・platform）は削除。手動移行の手順・対象・事前バックアップ・完了判定はADRに記載する（コミットメッセージ要件は統括の完了手順であり本タスクのACにしない）
- 現行はfast pathでも全メタをread+parseしている（metaIdMigration.ts:160-215）。重複検査は通常スキャンのメタ読取り1回に統合し、migration固有の二重read・ハッシュ計算・manifest判定を廃止する。scanner側 seenIds がWork IDしか見ていない点（scanner.ts:824-828）も統合時に全ID種へ揃える
- server/tests/real/metaIdMigration.test.ts は残す機能の分だけに縮小する
- ADR-0008はTASK-273（適合監査）も触るため、両タスクは同一セッションで順次実施し並行させない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャンには軽量な重複ID検出・修復ガードが残り、その挙動がテストで担保されていること
- [ ] #2 serverテスト全体が通ること
- [ ] #3 ADR-0008が改訂され、スキャン時の重複ID修復の保全要件（全ID種・原子的書込み・外部編集競合・失敗時復旧）と手動移行の手順・対象・事前バックアップ・完了判定が記載されていること
- [ ] #4 レガシー変換・manifest機構・テスト専用フックが削除されていること
- [ ] #5 重複検査が通常スキャンのメタ読取り1回に統合され、migration固有の二重read・ハッシュ計算・manifest判定が廃止されていること
- [ ] #6 スキャンがレガシーメタを自動変換せずファイルを変更しないことが回帰テストで担保されていること
<!-- AC:END -->
