---
id: TASK-239
title: 'motion再導入(2/8): TopBarとToastをAnimatePresenceへ移行する'
status: To Do
assignee: []
created_date: '2026-08-07 17:00'
updated_date: '2026-08-07 17:15'
labels: []
dependencies:
  - TASK-238
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のToast/fade関連の確定事項とこのタスク本文（フェーズ2）。TopBar(fade, initial={false}, absolute退出の実証)とToastの移行。ToastはToastContentを退出子コンポーネントとして切り出しuseIsPresent()でinert/リスナー制御。message=null時に即hidePopover()する現行実装では退出が見えないため、hidePopover()をonExitCompleteまで遅延し、表示世代トークンを照合して退出中に再表示された新Toastを古いコールバックが隠さないようにする。文言差し替えは現行の単一スロット契約(即時反映)を維持しkey={message}並存はさせない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 退出中にトースト文言が消えず退出アニメが視認できる
- [ ] #2 退出中の再表示で新Toastが古いコールバックに閉じられない(世代トークン照合のテストあり)
- [ ] #3 退出中のToastボタンがinertになっている
- [ ] #4 TopBarのfadeがabsolute退出を再現しinitial={false}が適用されている
- [ ] #5 Toast.test.tsx更新済みで pnpm check・変更範囲のテスト・pnpm test:smoke が通る
<!-- AC:END -->
