---
id: TASK-9
title: TanStack Query DevtoolsボタンとプレイヤーUIの位置競合を解消する
status: To Do
assignee: []
created_date: "2026-07-05 17:59"
labels:
  - ui
  - dx
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

TanStack Query Devtoolsの右下ボタンが、再生バー・ポップアップ・全画面プレイヤーの右下と重なる。開発環境限定の問題だが、UI確認・スクリーンショット・クリック検証時にノイズになる。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Devtoolsボタンの初期位置を左下や上部などプレイヤーUIと重ならない位置に変更する、またはプレイヤー表示中だけDevtoolsの位置をずらす
- [ ] #2 ビジュアル検証時にDevtoolsを無効化できるフラグを用意する
<!-- AC:END -->
