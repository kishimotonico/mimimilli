---
id: TASK-156
title: motion依存を削除しCSSトランジションへ置き換える
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 17:53'
updated_date: '2026-07-30 19:33'
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
- [ ] #1 package.jsonからmotionが削除され、バンドルにmotion-dom/framer-motion/motion-utilsが含まれない
- [ ] #2 既存の出現/退出アニメーション（TopBar・Toast・ScanModal・StackEdge・FilesView・PlayerDock）が体感同等のCSSトランジションで再現されている（ScanModalのlayoutアニメーション相当を含む）
- [ ] #3 ビジュアルテストが通る（アニメーション終状態が変わらない）
- [ ] #4 本番ビルドのgzipサイズ削減量を実測してタスクに記録する
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. motion 6ファイルの使用箇所をCSSトランジション+マウント制御へ置換（ScanModalのlayout含む）
2. package.jsonからmotion削除
3. ビジュアルテスト・バンドル実測
実装Cursor委譲、ビジュアル検証あり
<!-- SECTION:PLAN:END -->
