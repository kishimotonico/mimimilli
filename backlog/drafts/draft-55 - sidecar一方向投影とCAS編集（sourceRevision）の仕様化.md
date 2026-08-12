---
id: DRAFT-55
title: sidecar一方向投影とCAS編集（sourceRevision）の仕様化
status: Draft
assignee: []
created_date: '2026-08-12 10:35'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-28（archive済み）指摘13の残件＋2026-08-12設計レビュー（docs/application-architecture-review-2026-08-12.md 優先改善2）。

metaファイル書き込みのアトミック化（writeJsonAtomic、staging回収）は実装済みだが、外部エディタとの競合検知（楽観ロック）が無く、catalog更新とsidecar書き込みを同一SQLite callback内で行うcatalog-first経路が残る（server/src/adapters/real/workMethods.ts）。SQLite transactionはファイル書き込みをrollbackできない。

レビュー提案: 編集画面取得時にsourceRevision（sidecarのexact bytes由来）を返し、更新時に必須化、不一致なら409 source_changed。未知フィールドを保持したままpatch→atomic replace→確定bytesからその作品だけcatalogへ再投影するsource-first書き込みへ統一し、catalog-first経路を廃止。revisionの3分割（source/projection/media）は同レビュー優先改善4を参照。

着手時はまずADRとして確定する（レビュー実施順2）。移動追従・identity conflict（同改善3）と合わせて設計するのが望ましい。
<!-- SECTION:DESCRIPTION:END -->
