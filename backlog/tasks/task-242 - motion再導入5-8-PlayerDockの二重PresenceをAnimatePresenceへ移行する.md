---
id: TASK-242
title: 'motion再導入(5/8): PlayerDockの二重PresenceをAnimatePresenceへ移行する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 17:16'
labels: []
dependencies:
  - TASK-238
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のPlayerDock確定事項（フェーズ5・最高難度）。現行は旧・新を並存させ入場側だけ180ms遅延する方式で、mode="wait"は待機二重化のため使わず、並存+入場側delayで踏襲（delayはuseMotionVariants経由、transition.delay直書き禁止）。onExitCompleteでswitchingUiMode解除。PopupContentのwindowリスナーはuseIsPresent()で退出中解除。layout/layoutIdは再導入禁止（過去にカバー歪みで撤去済み）。presence.test.tsxが担っていたrapid toggle・onExitComplete一回保証の検証をこのフェーズの統合テストへ移管（onExitCompleteに渡すspyの呼び出し回数をfake timersで検証）。initial={false} 2箇所消化。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bar↔popup切替でswitchingUiModeが確実に解除される統合テストがある
- [ ] #2 高速連続切替でonExitComplete spyが期待回数だけ呼ばれる
- [ ] #3 PopupContentのwindowリスナーが退出中に解除される
- [ ] #4 切替モーションが体感同等でinitial={false} 2箇所が消化されている
- [ ] #5 pnpm check・変更範囲のテスト・pnpm test:smoke が通る
- [ ] #6 入場180msのdelayがuseMotionVariants経由で与えられている(transition.delay直書きなし。reduce時に0化されることのテストあり)
<!-- AC:END -->
