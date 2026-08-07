---
id: TASK-242
title: 'motion再導入(5/8): PlayerDockの二重PresenceをAnimatePresenceへ移行する'
status: Done
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 19:09'
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
- [x] #1 bar↔popup切替でswitchingUiModeが確実に解除される統合テストがある
- [x] #2 高速連続切替でonExitComplete spyが期待回数だけ呼ばれる
- [x] #3 PopupContentのwindowリスナーが退出中に解除される
- [x] #4 切替モーションが体感同等でinitial={false} 2箇所が消化されている
- [x] #5 pnpm check・変更範囲のテスト・pnpm test:smoke が通る
- [x] #6 入場180msのdelayがuseMotionVariants経由で与えられている(transition.delay直書きなし。reduce時に0化されることのテストあり)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PlayerDockの二重PresenceをAnimatePresence×2境界へ移行。旧・新を並存させ入場側だけ180ms遅延する方式を踏襲し、mode="wait"は不使用。barVariantはswitchingUiModeの真偽でdockBarSwitch/dockBarSlideを切り替え、popupVariantはdockPopupScale固定という旧実装のクラス付与ロジックと一致させた。delayはbuilder経由でtransition.delay直書きなし。onExitCompleteでswitchingUiModeを解除し、その一回保証は内部モックではなくMutationObserverで.mle-bar1/.mle-popupのDOM除去回数を数える方式で検証（各AP境界は子を高々1つしか持たないためDOM除去とonExitCompleteが1:1対応する）。PopupContentのwindowリスナーはuseIsPresent()で退出中解除し、実物コンポーネントでspy検証。presence.test.tsxのPlayerDock固有1件をplayerDock.test.tsx 3件へ移管し、PopupContentリスナー検証を新規追加。
<!-- SECTION:FINAL_SUMMARY:END -->
