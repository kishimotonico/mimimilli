---
id: TASK-290
title: レイヤ境界検査を動的importにも適用する
status: To Do
assignee: []
created_date: '2026-08-09 20:44'
labels: []
dependencies: []
priority: low
ordinal: 300000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-282で導入したレイヤ境界の機械的検証に、動的importのすり抜けがある。

scripts/check-layer-boundaries.mjs の collectImports は正規表現ベースで import("...") 形式（ImportExpression）を収集せず、oxlint の no-restricted-imports も静的import宣言のみが対象。そのため禁止依存（features間sibling、shared→features等）を動的importへ書き換えるだけで両方の検査を通過できる。現状のコードベースに違反はゼロで実害はないが、境界固定の趣旨からすると塞ぐ価値がある。

対応案: collectImports の正規表現に import( 形式を追加するか、境界スクリプトをAST解析（oxc-parser等）へ置き換えてImportExpressionも対象にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 layer跨ぎの動的importが check-layer-boundaries.mjs で検出されること
- [ ] #2 検出の実効性が違反を仕込んだ確認（テストまたは記録された手動確認）で担保されていること
<!-- AC:END -->
