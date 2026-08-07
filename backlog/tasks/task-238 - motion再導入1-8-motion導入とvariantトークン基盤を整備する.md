---
id: TASK-238
title: 'motion再導入(1/8): motion導入とvariantトークン基盤を整備する'
status: To Do
assignee: []
created_date: '2026-08-07 17:00'
updated_date: '2026-08-07 17:15'
labels: []
dependencies: []
ordinal: 248000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-156(バンドル削減目的のmotion削除)を覆し、アニメーション基盤をAnimatePresenceへ統一する移行の第1フェーズ。確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md（設計原則・確定事項。Codexレビュー4巡+独立検証済み）。motionをclient依存に追加、App.tsxにMotionConfig reducedMotion="user"（注: user設定はopacityアニメを止めないため不十分。全variantのduration/delayのreduce時0化はuseMotionVariants側で行う）、presenceDurations.tsの後継となるvariantトークンモジュール（useMotionVariants()フック+builder。プロパティ別duration・非対称scale・overshoot easing・transform-origin対応。delayも含め全パラメータをbuilder経由にしtransition.delay直書き禁止）、fade退出のposition:absolute再現方式の確定、collapse variantの確立（height:0↔auto方式）、tests/unit/setup.tsへのmatchMediaスタブ追加（change listener API含む）、skipInitial全13箇所(TopBar1/FilesView1/PlayerDock2/ScanModal9)のinitial={false}対応表作成。汎用ラッパーコンポーネントは作らない（TASK-156でのTransitionPresence自作破綻の教訓）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 motionが導入されMotionConfigとvariantトークンモジュール(useMotionVariants)が存在する
- [ ] #2 reduce時に全variantのduration/delayが0になる分岐がユニットテストで検証されている(matchMediaスタブ)
- [ ] #3 fade退出のabsolute再現方式とskipInitial 13箇所の対応表が計画ファイルまたはタスクノートに記録されている
- [ ] #4 pnpm --filter @mimimilli/client build で移行前のバンドル実測(全JS合計/初期チャンク別gzip)が記録されている
- [ ] #5 既存挙動に変化がなく pnpm check と pnpm test が通る
- [ ] #6 collapse variantが確立されている(motion公式サポートのheight:0↔auto + opacity + ルートoverflow:hidden。gridTemplateRows直接アニメは不採用。内側の子レイアウトflex/gapは維持)
<!-- AC:END -->
