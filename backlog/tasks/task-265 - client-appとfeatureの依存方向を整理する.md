---
id: TASK-265
title: client appとfeatureの依存方向を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
labels: []
dependencies: []
priority: medium
ordinal: 275000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した app↔feature の逆依存。
- app/ui/Breadcrumbs.tsx を features/library/LibraryBreadcrumbs と features/files/FilesBreadcrumbs がimport（feature→appの逆依存）→ shared/ui/Breadcrumbs へ移動
- app/model/useGlobalShortcuts.ts を features/player/PlayerRuntime がimport。ショートカットはplayer責務 → features/player/model へ移動
- App.tsx:127-145 のライブラリエクスポート実装（Blob生成・download名）→ features/library へ移し、Appはコールバックを渡すだけにする
- features/files/FileColumn.tsx が features/library/ui/CollectionStatus をimport → shared/ui へ昇格
- app/ui/AddressBar.tsx が library/files の部品を直接組み立てている点は、shellのcompositionとしての意図を確認し、意図的なら現状維持で良い（判断を統括へ報告）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 feature から app へのimportが消えていること
- [ ] #2 App.tsx からエクスポートのドメイン実装が消えていること
- [ ] #3 CollectionStatus の feature間importが解消されていること
- [ ] #4 clientのcheck・変更範囲のテストが通ること
<!-- AC:END -->
