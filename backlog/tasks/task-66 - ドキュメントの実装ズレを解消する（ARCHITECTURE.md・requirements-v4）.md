---
id: TASK-66
title: ドキュメントの実装ズレを解消する（ARCHITECTURE.md・requirements-v4）
status: To Do
assignee: []
created_date: '2026-07-19 03:08'
labels: []
dependencies: []
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘24。docs/ARCHITECTURE.md:55が「SSEによる進捗配信は未実装」と記載しているが、server/src/routes/scanProgress.ts で実装済み。docs/requirements-v4.md:179,252,473 はレジューム・A-Bリピート・MediaSession・再生速度等を将来扱いのままにしているが実装済み。グリッドの記述も現実装とズレ。

対応: メンテ対象docsの方針（追記でなく書き換えで現在の状態だけを保つ）に従い、実装済み機能の記述を現状に合わせて更新する。要件docは「現在保証する仕様」と「候補」を区別する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ARCHITECTURE.mdのSSE・検索処理方式などの記述が現実装と一致する
- [ ] #2 requirements-v4.mdで実装済み機能（レジューム・A-Bリピート・MediaSession・再生速度・グリッド表示）が現状扱いになっている
<!-- AC:END -->
