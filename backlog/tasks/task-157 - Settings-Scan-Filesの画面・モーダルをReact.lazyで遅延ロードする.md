---
id: TASK-157
title: Settings/Scan/Filesの画面・モーダルをReact.lazyで遅延ロードする
status: To Do
assignee: []
created_date: '2026-07-30 17:53'
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
- [ ] #1 SettingsModal・ScanModal・FilesViewが別チャンクに分割され、初回ロードのメインチャンクに含まれない
- [ ] #2 遅延ロード境界でUIのちらつき・操作不能時間が体感で発生しない（フォールバックの扱いが設計されている）
- [ ] #3 ビジュアルテストが通る
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
