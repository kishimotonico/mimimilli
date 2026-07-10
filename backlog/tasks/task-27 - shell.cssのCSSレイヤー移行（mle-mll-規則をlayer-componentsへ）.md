---
id: TASK-27
title: shell.cssのCSSレイヤー移行（mle-/mll-規則を@layer componentsへ）
status: To Do
assignee: []
created_date: '2026-07-10 10:39'
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
- [ ] #1 mll-系規則が@layer componentsに移り、Tailwindユーティリティで局所上書きできる
- [ ] #2 mle-系規則も段階的に移行される（段数は実装時に判断、完了時点で全規則がレイヤー内）
- [ ] #3 各段階でビジュアルテスト全パス（意図的な見た目変更はベースライン更新で記録）
- [ ] #4 docs/design-system.mdのレイヤー記述が実態と一致する
<!-- AC:END -->
