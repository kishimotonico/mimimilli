---
id: TASK-298
title: サムネイルクリックで画像を全画面拡大表示する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-08-10 19:00'
updated_date: '2026-08-11 05:19'
labels: []
dependencies: []
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サムネイルをクリックすると画面全体にオーバーレイして拡大表示する機能（ライトボックス）を追加する。現在この種の機能はリポジトリに存在しない（ファイルモードのプレビュー画像 client/src/features/files/ui/FilePreview.tsx:326-335 もonClickなし）。対象はライブラリ詳細パネルのサムネイルと、ファイルモードの画像プレビューで、挙動を揃える。閉じる操作はオーバーレイのクリックとEsc。アニメーションは motion/react の既存パターン（client/src/shared/ui/useMotionVariants.ts）に合わせ、reduced-motion設定を尊重する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ライブラリ詳細パネルのサムネイルクリックで全画面オーバーレイ表示される
- [x] #2 ファイルモードの画像プレビューでも同様に拡大表示できる
- [x] #3 オーバーレイのクリックまたはEscで閉じられる
- [x] #4 reduced-motion設定を尊重する
- [x] #5 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
shared/ui/Lightbox.tsxを新設。既存の<dialog>+showModal()パターン(useDialogModal)を再利用し、Escはネイティブcancelイベント経由（useWorkGridDismissは既存のdocument.querySelector('dialog[open]')チェックで自動的に競合回避、追加のstopPropagation実装は不要だった）。背景クリックはhandleBackdropClickを流用。アニメーションはpopoverScaleVariant(origin:'center')を使い、reduced-motion対応済み。バックドロップ色は既存全ダイアログと同じoklch(20% 0.02 70 / 0.3)トークンに統一。ハマった点: dialogをm-auto(shrink-to-fit)+img側をmax-w/max-hのみで組むと、画像本体が0x0に折りたたまれる挙動を確認（幅/高さのどちらも明示指定がない replaced element を shrink-to-fit コンテナに置いたときの計算崩れ、Chromiumで再現）。dialog側はh-screen/w-screen+flex items-center justify-centerの明示サイズに変更して解決。FilePreview.tsx側でimgをbuttonで包む実装も同じ理由で0x0になったため、buttonで包まずimg自体にrole=button/tabIndex/onClick/onKeyDownを付与する形に変更（WorkDetail.tsx側は.mle-prv__coverが140x140の明示サイズを持つため、button包み+h-full w-fullで問題なし）。WorkDetail.tsx: work.coverがある時のみカバーをbutton化しLightboxを開く。FilePreview.tsx: ImageMedia内のimgにクリック/キーボード操作を追加。both共通コンポーネントを使い挙動を統一。tsc/oxlint通過。agent-browserでライブラリ詳細・ファイルモード両方の開閉（サムネイルクリック/背景クリック/Esc/画像自体クリックで閉じないこと/reduced-motion即時反映）を実測確認。pnpm test:smoke 9/10通過、1件はTASK-301と同一の既存フレーキー。

【差し戻し対応】TASK-294/295で発見・修正した根本原因（AxisQuickOverlayの誤ホバー起動、useHoverGroupCoordinator.tsで対処）により、pnpm test:smokeのACをuncheck→再検証→recheckした。TASK-298自体（Lightbox）はこの問題と無関係。詳細はTASK-295のノート参照。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
共有のLightboxコンポーネント（ネイティブdialog + showModal、useDialogModal再利用）を新設し、ライブラリ詳細パネルのカバーとファイルモードの画像プレビューから呼ぶ。オーバーレイクリック・Escで閉じ、reduced-motionを尊重。Escは既存のdialog[open]チェックで詳細パネル解除と競合しない。
<!-- SECTION:FINAL_SUMMARY:END -->
