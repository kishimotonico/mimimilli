---
id: TASK-160
title: findWorkRootの祖先走査をインデックス化しO(audioDirs×metaDirs)を解消する
status: To Do
assignee: []
created_date: '2026-07-30 17:54'
labels: []
dependencies: []
priority: medium
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/src/adapters/real/scanner.ts:167付近のfindWorkRoot()が、各audio directoryについて全meta directoryの走査と祖先のreaddirSync繰り返しを行っており、メタ/音声が混在する大規模ライブラリでO(audioDirs×metaDirs)になりうる。walk時に親子インデックスと「配下にmetaあり」情報を構築して参照する方式へ変える。2026-07-31調査第2波・Codexレビュー追加発見。TASK-77（Filesモード対応付けのインデックス化）とは別経路（スキャナ側）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 findWorkRoot相当の解決がwalk時に構築したインデックス参照で行われ、audio directoryごとの全meta directory走査・祖先readdirSync繰り返しがない
- [ ] #2 作品ルート判定の結果が変更前と同一（既存スキャンテスト+境界ケースのテストが通る）
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
