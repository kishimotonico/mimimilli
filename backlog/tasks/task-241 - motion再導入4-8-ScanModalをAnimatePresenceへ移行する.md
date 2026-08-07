---
id: TASK-241
title: 'motion再導入(4/8): ScanModalをAnimatePresenceへ移行する'
status: Done
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 19:10'
labels: []
dependencies:
  - TASK-238
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のScanModal確定事項（フェーズ4）。StatusRowの排他3状態のみ単一スロット化し、方式はsync+退出absolute（mode="wait"は表示タイミングが変わるため使わない）。警告・新規作品・フッターのヒント/ボタン群は同時表示の組み合わせがあるため独立したAP境界のまま移行。inline境界9箇所は子コンポーネントとして切り出してuseIsPresent()を適用。警告・新規作品のcollapse×2はTASK-238で確立したheight:0↔auto方式のvariantを使う（最初の実利用）。initial={false}対応表のScanModal 9箇所を消化。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン各状態のクロスフェードが体感同等でsync+absolute方式になっている
- [x] #2 警告+新規作品など同時表示の組み合わせが欠落しない
- [x] #3 初回表示にアニメが走らない(initial={false} 9箇所消化)
- [x] #4 scanModal.test.tsのタイマー検証が更新され pnpm check・変更範囲のテスト・pnpm test:smoke が通る
- [x] #5 collapse×2がフェーズ1確立のcollapse variantを使い、静的レイアウトスタイルが維持されている
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ScanModalをAnimatePresenceへ移行。StatusRowの排他3状態のみをStatusStateに畳み込み単一AnimatePresence(sync、mode="wait"不使用)で切り替え、退出要素はexitAbsoluteで親のrelativeコンテナ内に並置クロスフェードする。警告・新規作品・フッターは同時表示の組み合わせがあるため独立AP境界のまま。inline境界9箇所を子コンポーネントへ切り出しuseIsPresent()でinertを付与し、initial={false}を9箇所消化した。collapse variantの最初の実利用として警告・新規作品の2箇所をheight:0↔auto方式へ移行し、旧.ml-presence-collapse__innerのflex/gapはラッパーDOMを足さずルートのclassNameとして維持している(gap:6px=gap-1.5を確認)。子レイアウト維持はフィクスチャ+agent-browserで実写確認。退出中の中間状態(2450ms時点で完了サインが残存)のアサーションを追加し、退出アニメが効いていることを検証している。
<!-- SECTION:FINAL_SUMMARY:END -->
