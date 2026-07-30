---
id: TASK-154
title: GET /api/fs の全作品ロードを廃止しパスベースの専用クエリにする
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 18:20'
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
- [ ] #1 GET /api/fs のディレクトリ表示で全作品のWorkSummary復元・全タグ取得が発生しない（physical_pathベースの絞り込みクエリで必要データのみ取得）
- [ ] #2 Filesモードの表示内容（作品対応付け・エントリ一覧）が変更前と同一（既存テスト+同値性確認）
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. browseFs用のパスベース専用問い合わせ（id/physical_path等の最小投影）をWorkRepoへ追加
2. adapters/real/index.tsのbrowseFsからlistSummaries()全件ロードを排除
3. Filesモード表示の同値性テスト+ベンチ再計測
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->
