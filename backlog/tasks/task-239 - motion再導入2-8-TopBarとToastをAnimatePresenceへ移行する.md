---
id: TASK-239
title: 'motion再導入(2/8): TopBarとToastをAnimatePresenceへ移行する'
status: Done
assignee: []
created_date: '2026-08-07 17:00'
updated_date: '2026-08-07 19:16'
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
- [x] #1 退出中にトースト文言が消えず退出アニメが視認できる
- [x] #2 退出中の再表示で新Toastが古いコールバックに閉じられない(世代トークン照合のテストあり)
- [x] #3 退出中のToastボタンがinertになっている
- [x] #4 TopBarのfadeがabsolute退出を再現しinitial={false}が適用されている
- [x] #5 Toast.test.tsx更新済みで pnpm check・変更範囲のテスト・pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TopBarのDLsite一括取得「中止」ボタンとToastをAnimatePresenceへ移行。TopBarはDlsiteBulkCancelButtonを切り出しfade()のexitAbsoluteで退出させ、initial={false}を1箇所消化した。fade退出のposition:absoluteが最も近いpositioned ancestorを基準にするため、.mll-barにposition:relativeを追加している(旧CSS実装も同じ性質を持ちながら祖先が全てstaticでviewport基準になっていたが、ヘッダーが最上段かつ全幅のため顕在化していなかった。z-index未指定なので新しいstacking contextは生成されない)。ToastはToastContentをmotion.outputとして切り出しuseIsPresent()でinertを付与、hidePopover()をonExitCompleteまで遅延した。表示世代トークンはADR改訂により撤去(AnimatePresenceがkey未指定の子を同一キーとして扱うため、退出中の再表示は同キー再出現とみなされて退出が取り消され、onExitCompleteが発火しない。ガードが到達不能な死んだコードになるため)。
<!-- SECTION:FINAL_SUMMARY:END -->
