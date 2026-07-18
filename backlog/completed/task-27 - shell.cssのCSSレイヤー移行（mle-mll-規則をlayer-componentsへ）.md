---
id: TASK-27
title: shell.cssのCSSレイヤー移行（mle-/mll-規則を@layer componentsへ）
status: Done
assignee:
  - '@sonnet'
created_date: '2026-07-10 10:39'
updated_date: '2026-07-12 00:08'
labels:
  - ui
  - dx
dependencies: []
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計調査（2026-07-10）で判明: @layer base内にあるのはbuttonリセットだけで、ほぼ全てのmle-/mll-規則はレイヤー外。レイヤー外CSSはTailwind utilitiesより強く、例えばSmartFolderEditorModalの gap-2 p-2.5 はshell.cssに上書きされて効いていない。docs/design-system.mdの「shell.cssは@layer base運用」とも不一致。リセットを@layer base、コンポーネント規則を@layer componentsに整理する。一括移行は差分が大きいため、library新規領域（mll-）から段階的に移し、各段でビジュアルテストを回す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mll-系規則が@layer componentsに移り、Tailwindユーティリティで局所上書きできる
- [x] #2 mle-系規則も段階的に移行される（段数は実装時に判断、完了時点で全規則がレイヤー内）
- [x] #3 各段階でビジュアルテスト全パス（意図的な見た目変更はベースライン更新で記録）
- [x] #4 docs/design-system.mdのレイヤー記述が実態と一致する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnet実装、Fableレビュー・検証。リセット=@layer base、mle-/mll-全規則=@layer componentsへ一括移行（レイヤー内の相対順序は不変）。見た目が変わる箇所は事前洗い出し通り2件のみで、両方とも意図した是正: SmartFolderEditorModalのgap/padding（実測8px/10pxでユーティリティが有効化）、WorkTrackListのイコライザー（横並び+アクセント色、実機確認済み）。work detailスナップショット3枚の差分はstash切り分けでTASK-36のDLsite UI追加による既存の未更新と特定し、ベースライン更新（visual 3回連続全パス）。design-system.md/HANDOFFのレイヤー記述も更新。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
shell.css全規則をCSSレイヤー内へ移行しTailwindユーティリティの局所上書きを可能に。コミット a853241。
<!-- SECTION:FINAL_SUMMARY:END -->
