---
id: TASK-241
title: 'motion再導入(4/8): ScanModalをAnimatePresenceへ移行する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 17:15'
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
- [ ] #1 スキャン各状態のクロスフェードが体感同等でsync+absolute方式になっている
- [ ] #2 警告+新規作品など同時表示の組み合わせが欠落しない
- [ ] #3 初回表示にアニメが走らない(initial={false} 9箇所消化)
- [ ] #4 scanModal.test.tsのタイマー検証が更新され pnpm check・変更範囲のテスト・pnpm test:smoke が通る
- [ ] #5 collapse×2がフェーズ1確立のcollapse variantを使い、静的レイアウトスタイルが維持されている
<!-- AC:END -->
