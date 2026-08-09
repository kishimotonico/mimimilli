---
id: TASK-265
title: client appとfeatureの依存方向を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 00:28'
labels: []
dependencies: []
priority: medium
ordinal: 275000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した app↔feature の逆依存。
- app/ui/Breadcrumbs.tsx を features/library/LibraryBreadcrumbs と features/files/FilesBreadcrumbs がimport → shared/ui/Breadcrumbs へ移動
- app/model/useGlobalShortcuts.ts を features/player/PlayerRuntime がimport → features/player/model へ移動
- Codexレビュー反映（漏れ2件）: features/files/ui/FilePreview.tsx:4 と features/library/ui/DlsiteNotificationModals.tsx:3-4 にも feature→app のimportがある。個別列挙に頼らず、rgによる機械的検査で全件を洗い出して解消する
- App.tsx:127-145 のライブラリエクスポート実装（Blob生成・download名）→ features/library へ移し、Appはコールバックを渡すだけにする
- features/files/FileColumn.tsx が features/library/ui/CollectionStatus をimport → shared/ui へ昇格
- app/ui/AddressBar.tsx が library/files の部品を直接組み立てている点は、shellのcompositionとしての意図を確認し、意図的なら現状維持で良い（判断を統括へ報告）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 App.tsx からエクスポートのドメイン実装が消えていること
- [ ] #2 CollectionStatus の feature間importが解消されていること
- [ ] #3 clientのcheck・変更範囲のテストが通ること
- [ ] #4 client/src/features 配下から app/ へのimportが0件であることをrgで機械的に確認していること（app→featureのcompositionは許可）
<!-- AC:END -->
