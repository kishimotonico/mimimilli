---
id: TASK-157
title: Settings/Scan/Filesの画面・モーダルをReact.lazyで遅延ロードする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 21:43'
labels: []
dependencies: []
priority: medium
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
clientの本番バンドルは単一チャンク（コード分割ゼロ）。src/app/App.tsxでSettingsModal/ScanModalが、src/app/AppBody.tsx:3-4でLibraryViewとFilesViewが静的importされており、appModeAtomで排他なのに両方初回ロードされる。Providers.tsx:21-26のReactQueryDevtoolsに既存のlazy()パターンがあるので同様に展開する。SetupScreenは初回利用時に必ず必要なため対象外（Codexレビュー指摘）。主効果は初回parse/eval削減。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SettingsModal・ScanModal・FilesViewが別チャンクに分割され、初回ロードのメインチャンクに含まれない
- [x] #2 遅延ロード境界でUIのちらつき・操作不能時間が体感で発生しない（フォールバックの扱いが設計されている）
- [x] #3 ビジュアルテストが通る
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. SettingsModal/ScanModal/FilesViewをReact.lazy化（Devtoolsの既存パターン踏襲）
2. チャンク分割の確認とフォールバック設計
3. ビジュアルテスト
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SettingsModal/ScanModal/FilesViewをlazy+Suspense(fallback null)で分割。メインチャンク560→534KB(gzip -5.9KB)、3チャンク各8-11KB。モーダルはshowModal()表示のためちらつきなし判断。415テスト・ビジュアル6/6・pnpm check通過。実装Cursor委譲。
<!-- SECTION:FINAL_SUMMARY:END -->
