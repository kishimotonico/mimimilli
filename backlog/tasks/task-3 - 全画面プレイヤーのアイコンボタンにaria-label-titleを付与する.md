---
id: TASK-3
title: 全画面プレイヤーのアイコンボタンにaria-label/titleを付与する
status: To Do
assignee: []
created_date: '2026-07-05 17:58'
labels:
  - ui
  - player
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
全画面プレイヤー内の前/次/ループなどのアイコンボタンがagent-browserのスナップショットで単なるbuttonとしか認識されず、アクセシブル名がない。ポップアップ側は「前のトラック」「次のトラック」「ループ」などの名前が付いているため、全画面側だけ一貫性が弱い。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 全画面プレイヤーの各トランスポートボタン（前/次/ループ等）にaria-labelとtitleを付与する
- [ ] #2 状態を持つボタン（ループなど）にはaria-pressedも付与する
- [ ] #3 IconButtonコンポーネントに収まらない専用の円形ボタンにも同じアクセシブル名付与ルールを適用する
<!-- AC:END -->
