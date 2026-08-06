---
id: TASK-213
title: smartFolderEditorの古いコメントを実装に合わせる
status: To Do
assignee: []
created_date: '2026-08-06 04:59'
labels: []
dependencies: []
priority: low
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/library/model/smartFolderEditor.ts:40-45 のコメントが「現状 LibraryView.tsx が useState<SmartFolder | null | undefined>() でこの状態を持っており…」と書いているが、実際の LibraryView.tsx:64-66 は既に useState<SmartFolderEditorState>（判別可能union）へ移行済みで、コメントが指す残作業は解消されている。

実害はないが、コメントが過去の状態を指したまま更新されておらず、読む人が「まだ直っていない」と誤解する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smartFolderEditor.ts のコメントが現在の LibraryView の実装（判別可能unionによる状態保持）と一致している
- [ ] #2 同様に解消済みの残作業を指したままのコメントが library feature 内に他に残っていないか確認されている
<!-- AC:END -->
