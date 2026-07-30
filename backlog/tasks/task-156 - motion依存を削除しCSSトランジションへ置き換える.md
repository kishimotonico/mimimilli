---
id: TASK-156
title: motion依存を削除しCSSトランジションへ置き換える
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 21:31'
labels: []
dependencies: []
priority: high
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
framer-motion系（motion-dom+framer-motion+motion-utils）が推定gzip 47KB（バンドル全体211KBの22%）を占めるが、使用は6ファイル（TopBar.tsx, Toast.tsx, ScanModal.tsx, StackEdge.tsx, FilesView.tsx, PlayerDock.tsx）の出現/退出アニメーションのみ。ScanModal.tsx:208はlayoutプロパティを使用しているためLazyMotion+domAnimationへの単純置換は不可（Codexレビュー指摘）。フェード/スライドはCSSトランジション+マウント制御で置き換え、motionパッケージを依存から削除する。見た目はdocs/design-system.mdのmotion規約に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.jsonからmotionが削除され、バンドルにmotion-dom/framer-motion/motion-utilsが含まれない
- [x] #2 既存の出現/退出アニメーション（TopBar・Toast・ScanModal・StackEdge・FilesView・PlayerDock）が体感同等のCSSトランジションで再現されている（ScanModalのlayoutアニメーション相当を含む）
- [x] #3 ビジュアルテストが通る（アニメーション終状態が変わらない）
- [x] #4 本番ビルドのgzipサイズ削減量を実測してタスクに記録する
- [x] #5 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. motion 6ファイルの使用箇所をCSSトランジション+マウント制御へ置換（ScanModalのlayout含む）
2. package.jsonからmotion削除
3. ビジュアルテスト・バンドル実測
実装Cursor委譲、ビジュアル検証あり
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
バンドル実測: raw 685KB→562KB(-18%) / gzip 211KB→169KB(-42KB, -20%)。
Codexレビュー5巡の経緯: 当初の汎用TransitionPresence（AnimatePresenceクローン）はP1が出続けたため、統括判断で廃止し「単一要素Presence+CSS」構成へ単純化（PlayerDockはPresence2並置+delay、ScanModalは有限状態クロスフェード、FilesViewカラムは入場のみアニメーション・退出即時）。最終レビューはP2の磨き3件で収束、全対応済み。実機スモーク（agent-browser）で起動・コンソールエラーなし確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
framer-motion系を全削除（gzip -42KB、バンドル20%削減）。usePresence/Presence（単一要素・durationタイマー主導・variant別CSS・prefers-reduced-motion対応）を新設し6コンポーネントを置換。汎用の複数子presence管理は過剰実装と判断し不採用。client 415テスト・ビジュアル6/6・pnpm check通過。
<!-- SECTION:FINAL_SUMMARY:END -->
