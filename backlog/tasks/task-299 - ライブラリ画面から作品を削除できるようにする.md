---
id: TASK-299
title: ライブラリ画面から作品を削除できるようにする
status: To Do
assignee: []
created_date: '2026-08-10 19:00'
labels: []
dependencies:
  - TASK-285
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
物理ファイルを先に削除・移動するとライブラリ側に作品が残るが、ライブラリ画面に削除導線が無い。DELETE /works/:id（server/src/routes/works.ts:82-84）とdeleteWork()（client/src/features/files/api.ts:34-35）は存在するが、呼び出し元はファイルモードのFilePreview（client/src/features/files/ui/FilePreview.tsx:70-79）のみ。作品詳細パネルからライブラリ登録を解除できるようにする（確認ダイアログ付き、物理ファイルは消えない旨を明記）。ファイル欠損ビュー（missing軸、client/src/entities/library/axisDefinitions.ts:20）の作品も同じ導線で削除できること。欠損作品の一括削除はチェックボックス選択機構と合わせて別ドラフトで扱う。unregisterWorkの退避メタ孤児化（TASK-285）と関係するため整合に注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 作品詳細パネルから作品をライブラリから削除できる（確認ダイアログ付き）
- [ ] #2 ファイル欠損ビューの作品も同じ導線で削除できる
- [ ] #3 削除後、一覧と件数が即時更新される
- [ ] #4 pnpm test:smoke が通る
<!-- AC:END -->
