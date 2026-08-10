---
id: TASK-154
title: GET /api/fs の全作品ロードを廃止しパスベースの専用クエリにする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 18:35'
labels: []
dependencies: []
priority: high
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/index.ts:784-788付近のbrowseFsが、1ディレクトリ表示のたびに全WorkSummary取得+全タグ取得（DLsite JSON等の復元込み）を行っている。FSブラウズに必要なのは対象パス配下/祖先の作品対応付けのみなので、id/physical_path等の必要最小の専用問い合わせに置き換える。2026-07-31調査第2波S1。アーキ的歪みが最も大きい箇所とされた。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/fs のディレクトリ表示で全作品のWorkSummary復元・全タグ取得が発生しない（physical_pathベースの絞り込みクエリで必要データのみ取得）
- [x] #2 Filesモードの表示内容（作品対応付け・エントリ一覧）が変更前と同一（既存テスト+同値性確認）
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. browseFs用のパスベース専用問い合わせ（id/physical_path等の最小投影）をWorkRepoへ追加
2. adapters/real/index.tsのbrowseFsからlistSummaries()全件ロードを排除
3. Filesモード表示の同値性テスト+ベンチ再計測
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ベンチ: /api/fsルート 329ms→71ms(p50, 4.6倍)。ルートは全作品が子孫の最悪ケースで、深い階層はさらに軽い。Codexレビュー2件（Windowsパス区切りのLIKE境界・重複physical_pathの先勝ち順）を修正済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
browseFsをlistSummaries()全件ロードからlistFsWorkRefs(directoryPath)（id/physical_pathのみ・同一/祖先/子孫のSQL絞り込み・OSネイティブ区切り境界・rowid順で先勝ち一致）へ置換。/api/fs 329ms→71ms。server 364テスト・pnpm check通過。実装Cursor委譲、Codexレビュー2件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
