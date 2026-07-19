---
id: TASK-68
title: SQLite復元時のZod検証を導入し型アサーションを排除する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 03:09'
updated_date: '2026-07-19 03:28'
labels: []
dependencies: []
modified_files:
  - server/src/adapters/real/schema.ts
  - server/src/adapters/real/workRepo.ts
  - server/tests/real/workRepoPersistence.test.ts
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘9。workRepo.ts:53,72の `row.status as WorkStatus`、375,387,443の `sort as SortId`、schema.ts:20-21の `$type<UrlEntry[]>()/$type<Playlist[]>()` はランタイム検証なしで、古いDB・手動編集・スキーマ不整合がそのままAPIへ流れる。

対応: DB行→ドメイン型の変換を1箇所に集約し、Zod（shared契約）で検証する。壊れた永続データは500ではなく診断可能なデータ整合性エラーとして扱う（過度なフォールバック禁止の方針どおり、隠蔽しない）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DB行からドメイン型への変換が集約され、Zod検証を通る
- [x] #2 workRepo.tsのstatus/sort等のas型アサーションが排除されている
- [x] #3 不正な永続データが診断可能なエラーとして報告される（テストで検証）
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shared契約のZodスキーマを使い、work・smart folder・search presetのDB行変換をworkRepo内の専用関数へ集約する
2. JSON列とenumを復元時に検証し、レコード識別子とフィールド名を含むデータ整合性エラーへ整形する
3. 壊れたstatus・playlists JSON・sort系の回帰テストをnode:testで追加する
4. pnpm checkとpnpm testを通し、受け入れ条件と完了状態をCLIで更新する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
JSON列をDrizzleのmode=jsonから生TEXTへ変更し、workRepoのrowToWork/rowToSummaryおよびsmart folder・search preset変換でJSON.parseとshared Zod契約を適用した。PersistentDataErrorはテーブル、レコードID、ZodパスまたはSQLite列名を含む。

パフォーマンス判断: listSummariesではworkSchemaによる詳細DTO検証を避け、workSummarySchemaを1回とtrackCount算出に必要なplaylist配列を1回だけ検証する。既知のN+1はTASK-57の範囲として変更していない。

検証: pnpm check、pnpm test 成功。server 21テストファイル、client 33テストファイル（238テスト）が通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SQLiteからの復元をworkRepoの行変換へ集約し、works、work_dlsite、smart_folders、search_presetsのJSON列とenumをshared Zod契約で検証するようにした。壊れたstatus、playlists、JSON構文、sortがレコードIDとフィールド名を含むPersistentDataErrorになるテストを追加。pnpm checkとpnpm testは成功。
<!-- SECTION:FINAL_SUMMARY:END -->
