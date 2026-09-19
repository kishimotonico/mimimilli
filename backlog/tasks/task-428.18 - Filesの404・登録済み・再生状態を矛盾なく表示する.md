---
id: TASK-428.18
title: Filesの404・登録済み・再生状態を矛盾なく表示する
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - files
  - error-state
dependencies: []
modified_files:
  - client/src/features/files/ui/FilesView.tsx
  - client/src/features/files/ui/FilePreview.tsx
  - client/src/features/files/ui/FileRow.tsx
parent_task_id: TASK-428
priority: high
ordinal: 445000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
files-A-01/A-02/A-03とB重複。404でも合成entryから登録操作が出て、単一ファイル作品の登録済み表示が欠け、再生中でも同じ再生ボタンになる。real adapterの契約に沿って表示状態を分ける。

決定（DRAFT-74 Q-02, 2026-09-07）: プレビューは閉じる操作とリサイズの両方に対応する。狭い幅ではプレビューを全幅表示へ切り替える。ファイル一覧カラムの300px固定で名前が切れ、プレビュー側に大きな空白が残る問題（files-A/B の所見）も同じ変更で解消する。

決定（DRAFT-74 Q-05, 2026-09-07）: Filesでの絶対パスコピーを許可する。ローカル専用機能であることを明示し、明示的なコピー操作と成功通知（トースト契約は TASK-428.2 に従う）を提供する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 404では左右とも対象なしを表示し、登録・再生を隠して上位またはルートへ戻れる
- [x] #2 5xxと通信失敗では再試行を維持し404と区別する
- [x] #3 単一ファイル作品に登録済みバッジと作品タイトルを表示する
- [x] #4 再生中・一時停止中・未再生で一時停止・再開・再生の操作が一致する
- [x] #5 pnpm test:smokeに新規失敗がない
- [x] #6 プレビューを閉じられ幅をリサイズでき、狭い幅では全幅表示へ切り替わる（一覧カラム300px固定による名前の切れとプレビュー側の余白も解消する）
- [x] #7 絶対パスを明示的な操作でコピーでき、成功トーストとローカル専用機能である旨の説明を表示する
<!-- AC:END -->
