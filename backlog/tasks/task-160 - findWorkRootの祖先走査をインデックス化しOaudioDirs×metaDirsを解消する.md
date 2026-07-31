---
id: TASK-160
title: findWorkRootの祖先走査をインデックス化しO(audioDirs×metaDirs)を解消する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:54'
updated_date: '2026-07-30 19:06'
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
- [x] #1 findWorkRoot相当の解決がwalk時に構築したインデックス参照で行われ、audio directoryごとの全meta directory走査・祖先readdirSync繰り返しがない
- [x] #2 作品ルート判定の結果が変更前と同一（既存スキャンテスト+境界ケースのテストが通る）
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. walk時に親子インデックス・配下meta有無を構築
2. findWorkRootをインデックス参照へ
3. 境界ケーステスト
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexレビュー3件対応: root正規化（resolve）、等価性テストを本番walk/findWorkRoot経由へ修正、walkスナップショット意味論は意図した仕様としてdocコメント明記（再検証は過剰と判断し不採用）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
walk時にdirIndex（直下サブフォルダー数・画像有無）とdirsWithMetaInSubtree（配下メタ有無）を構築し、findWorkRootを祖先チェーンのインデックス参照のみに変更。O(audioDirs×metaDirs)→O(audioDirs×深さ)。旧実装オラクルとの等価性テスト+境界ケース7件。server 373テスト・pnpm check通過。
<!-- SECTION:FINAL_SUMMARY:END -->
