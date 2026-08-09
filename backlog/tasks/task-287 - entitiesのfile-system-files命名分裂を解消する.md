---
id: TASK-287
title: entitiesのfile-system/files命名分裂を解消する
status: To Do
assignee: []
created_date: '2026-08-09 19:14'
labels: []
dependencies: []
priority: low
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-264が client/src/entities/file-system/（api.ts・queryKeys.ts）を作った後、TASK-282が別途 client/src/entities/files/model/navigationAtoms.ts を新設した。同一ドメインに対してディレクトリが2つある状態で、client/src/features/files/ui/FilesView.tsx が両方をimportしている（:12 と :23）。

既存API命名と揃う file-system 側へ統合する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 entities配下のディレクトリが1つに統合され、同一ドメインの分裂が解消していること
- [ ] #2 旧パスへのre-exportやエイリアスが残っていないこと
- [ ] #3 pnpm check と pnpm test が通ること
<!-- AC:END -->
