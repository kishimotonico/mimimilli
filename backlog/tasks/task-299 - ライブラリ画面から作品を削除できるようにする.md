---
id: TASK-299
title: ライブラリ画面から作品を削除できるようにする
status: To Do
assignee: []
created_date: '2026-08-10 19:00'
updated_date: '2026-08-18 22:57'
labels: []
dependencies:
  - TASK-285
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
物理ファイルを先に削除・移動するとライブラリ側に作品が残るが、ライブラリ画面に削除導線が無い。DELETE /works/:id（server/src/routes/works.ts:108-109）とdeleteWork()（client/src/features/files/api.ts:37-38）は存在するが、呼び出し元はファイルモードのFilePreview（client/src/features/files/ui/FilePreview.tsx:80-81）のみ。作品詳細パネル（client/src/features/library/ui/preview/WorkDetail.tsx / WorkMetadataActions.tsx）からライブラリ登録を解除できるようにする（確認ダイアログ付き、物理ファイルは消えない旨を明記）。

TASK-304でmissing軸は廃止され、現在はエラービュー（view: "error"、status !== "ok" を含む）に統合されている。エラービューから開いた欠損作品も同じ導線で削除できること（軸ではなく work.status === "missing" で判定できる）。欠損作品の一括削除はチェックボックス選択機構と合わせてDRAFT-53で扱う。unregisterWorkの退避メタ孤児化（TASK-285、完了済み）と関係するため整合に注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 作品詳細パネルから作品をライブラリから削除できる（確認ダイアログ付き）
- [ ] #2 削除後、一覧と件数が即時更新される
- [ ] #3 pnpm test:smoke が通る
- [ ] #4 エラービュー（view: error）に現れる欠損作品も同じ導線で削除できる
<!-- AC:END -->
