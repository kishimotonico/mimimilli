---
id: TASK-298
title: サムネイルクリックで画像を全画面拡大表示する
status: To Do
assignee: []
created_date: '2026-08-10 19:00'
labels: []
dependencies: []
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サムネイルをクリックすると画面全体にオーバーレイして拡大表示する機能（ライトボックス）を追加する。現在この種の機能はリポジトリに存在しない（ファイルモードのプレビュー画像 client/src/features/files/ui/FilePreview.tsx:326-335 もonClickなし）。対象はライブラリ詳細パネルのサムネイルと、ファイルモードの画像プレビューで、挙動を揃える。閉じる操作はオーバーレイのクリックとEsc。アニメーションは motion/react の既存パターン（client/src/shared/ui/useMotionVariants.ts）に合わせ、reduced-motion設定を尊重する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ライブラリ詳細パネルのサムネイルクリックで全画面オーバーレイ表示される
- [ ] #2 ファイルモードの画像プレビューでも同様に拡大表示できる
- [ ] #3 オーバーレイのクリックまたはEscで閉じられる
- [ ] #4 reduced-motion設定を尊重する
- [ ] #5 pnpm test:smoke が通る
<!-- AC:END -->
