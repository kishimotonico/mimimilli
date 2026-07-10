---
id: DRAFT-16
title: マーキング機能（お気に入り＋あとで整理フラグ）
status: Draft
assignee: []
created_date: '2026-07-10 12:35'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホから許す唯一の書き込み。作品への「お気に入り」と「あとでPCで整理する」フラグの2つだけをトグルできる。現状お気に入りはLeftNavのラベル（client/src/app/ui/LeftNav.tsx の star）のみでデータモデルが無いため、shared(Zod)の契約定義・server(Hono)のAPI・永続化から実装する。PC側ではLeftNavの「お気に入り」を配線し、「あとで整理」は整理作業の起点として一覧できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sharedに契約が定義され、APIでマークの取得/更新ができる
- [ ] #2 スマホ・PC両方の作品UIからお気に入りをトグルできる
- [ ] #3 「あとで整理」を付けた作品をPC側で一覧できる
<!-- AC:END -->
