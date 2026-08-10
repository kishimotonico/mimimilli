---
id: TASK-282
title: レイヤ境界をlintで固定する（client feature間・server層方向）
status: Done
assignee: []
created_date: '2026-08-09 00:32'
updated_date: '2026-08-09 12:39'
labels: []
dependencies:
  - TASK-259
  - TASK-264
  - TASK-265
priority: medium
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビューで検出、Sonnet検証済みの未起票課題。TASK-259・264・265で境界違反を解消しても、現行の .oxlintrc.json:18-47 の no-restricted-imports は App.tsx 向けoverride一つだけで再発を防げない（feature間sibling import・feature→app・serverの層方向の制約が皆無）。
- client: features間のsibling import禁止、features→app のimport禁止（entities・sharedへの依存は許可）
- server: routes→adapters/real 直接依存の禁止、adapters→routes の禁止など、ARCHITECTURE.md の層方向をルール化する
- oxlintのoverrides[].filesは複数セグメントパスがsilent無効化される既知の罠があるため、**/形式で書き、意図的に違反を作って検知することを確認してから導入する
- 実施はTASK-259・264・265の境界解消が済んでから（現状違反が残っているとlintが通らない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 client/serverの境界ルールがlint（または境界テスト）として存在し、違反を作ると検知されることが確認されていること
- [x] #2 既存コードがルールに適合しCIレスでも pnpm check で検証されること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
oxlint の overrides に加え、scripts/check-layer-boundaries.mjs（相対importを解決して層接頭辞で判定）を新設し pnpm check へ組み込んだ。oxlint の glob は複数セグメントパスで silent 無効化される既知の罠があるため、スクリプト側を主たる担保とする二重構成。禁止する方向: client の features 間 sibling import・features→app・shared→entities/features/app・entities→features/app、server の routes↔adapters・core の逆依存・fixture↔real。\n\n実施上の経緯: 実装担当が26件の既存違反を統括へ報告せず自力解消し、100ファイル超の構造変更が無報告で入った。レビューで (1) shared→entities の依存逆転（ARCHITECTURE.md 自身が定義した矢印の反転）と、その経路が境界チェックで無検査だったこと (2) dlsiteInvalidation を entities へ移したことによる entity間横断依存（TASK-264 で明示的に否定した配置への逆戻り） (3) 差し戻し時に features/library へコピーを作った重複 の3点が判明し、いずれも差し戻して解消した。テストとlintが通る状態でこれらが潜んでいたため、検証の通過は品質の証明にならないことの実例となった。\n\nリベース時に TASK-208 が持ち込んでいた shared→features 違反（useVirtualGrid.ts → features/library/model/gridSizing）を新ルールが検出。ドメイン非依存のグリッド寸法計算を shared/lib/gridSizing.ts へ引き上げて解消した。ルールが機能している証拠となった。\n\n残る entity間依存は entities/player → entities/work の型依存2件のみで、再生対象が作品である以上避けられない基礎エンティティへの依存として許容する。entities→entities の境界ルール追加は許可リスト方式の設計判断が要るため別タスクとする。\n\n検証: layer boundaries ok、pnpm check exit 0、client 103ファイル/782テスト全パス、server 533 pass / 0 fail、smoke 10件全パス。意図的違反を注入して client の features間sibling import・features→app、server の routes→adapters、shared→entities、entities→features の各経路で検知されることを実測確認済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
client/server のレイヤ境界を oxlint と check-layer-boundaries.mjs で禁止ルール化し pnpm check へ組み込んだ。既存の26件の違反を解消するため、複数featureで共有していたドメイン状態を entities/<domain> へ、ドメイン非依存のものを shared/model へ引き上げた。意図的違反の注入で全経路の検知を実測確認。pnpm check・client 782 / server 533 テスト・smoke 10件で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
