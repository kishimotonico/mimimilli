---
id: TASK-301
title: 'smoke: クイックオーバーレイの残留でクリックがブロックされ主要画面ヨコスクロールテストがフレーキーになる'
status: To Do
assignee: []
created_date: '2026-08-10 23:27'
labels: []
dependencies: []
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tests/smoke/library.smoke.spec.ts の「主要画面でヨコ方向スクロールが発生しない」が、同ファイル内の他テストと一緒に実行すると .mll-qoverlay（AxisQuickOverlay）が残留して作品タイトルのクリックをブロックし、30秒タイムアウトで落ちる（単体実行では通る）。TASK-294〜298の検証中に発見。原因調査と、テスト順不同でも安定するようにする（openApp後にオーバーレイを閉じる/表示条件を見直す等）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 同ファイルの全テストを通しで実行してもオーバーレイのクリックブロックで失敗しない
- [ ] #2 根本原因（オーバーレイが自動的に開く条件）が特定され、修正または意図的な仕様として記録される
<!-- AC:END -->
