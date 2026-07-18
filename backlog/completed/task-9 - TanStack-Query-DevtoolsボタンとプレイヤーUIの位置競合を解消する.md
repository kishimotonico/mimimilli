---
id: TASK-9
title: TanStack Query DevtoolsボタンとプレイヤーUIの位置競合を解消する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-05 17:59'
updated_date: '2026-07-10 09:48'
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
- [x] #1 Devtoolsボタンの初期位置を左下や上部などプレイヤーUIと重ならない位置に変更する、またはプレイヤー表示中だけDevtoolsの位置をずらす
- [x] #2 ビジュアル検証時にDevtoolsを無効化できるフラグを用意する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェントがセッション制限で中断（途中差分あり・tsc通過状態）。Codexへ引き継ぎ、残実装を委譲。

Codexが引き継ぎ完成、Fable検証: Devtoolsトグルが左下(12,12)に移動したことを実測、VITE_DISABLE_QUERY_DEVTOOLS=1をplaywright webServerに配線。コミット b16a593。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Devtoolsトグルを左下へ移動、ビジュアルテスト時は環境変数で無効化。
<!-- SECTION:FINAL_SUMMARY:END -->
