---
id: TASK-295
title: 作品詳細パネルに閉じるボタンを追加しヘッダー行を削除する
status: To Do
assignee: []
created_date: '2026-08-10 18:59'
labels: []
dependencies: []
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
詳細パネルを閉じる手段が空白クリックとEscのみで操作しづらい（client/src/features/library/ui/workGrid/useWorkGridDismiss.ts:1-44）。パネルの外側左端に縦長の右矢印ボタンを設置し、クリックで既存のスライドアウトアニメーション（client/src/shared/ui/useMotionVariants.ts:245-257 の previewSlideVariant、LibraryView.tsx:64-73 PreviewPaneSlide）に乗せて閉じられるようにする。あわせて、パネル最上部のヘッダー行（「詳細」ラベルのみで機能を持たない。client/src/features/library/ui/PreviewPane.tsx:57-60、client/src/styles/shell/preview-a.css:20-32）を削除してコンテンツ領域を広げる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 詳細パネル脇の縦長右矢印ボタンでパネルが閉じられる（アニメーション付き）
- [ ] #2 既存の空白クリック・Escでの解除も引き続き動作する
- [ ] #3 「詳細」ラベルのヘッダー行が削除される
- [ ] #4 pnpm test:smoke が通る
<!-- AC:END -->
