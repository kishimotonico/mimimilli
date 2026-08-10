---
id: TASK-238
title: 'motion再導入(1/8): motion導入とvariantトークン基盤を整備する'
status: Done
assignee: []
created_date: '2026-08-07 17:00'
updated_date: '2026-08-07 18:13'
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
- [x] #1 motionが導入されMotionConfigとvariantトークンモジュール(useMotionVariants)が存在する
- [x] #2 reduce時に全variantのduration/delayが0になる分岐がユニットテストで検証されている(matchMediaスタブ)
- [x] #3 fade退出のabsolute再現方式とskipInitial 13箇所の対応表が計画ファイルまたはタスクノートに記録されている
- [x] #4 pnpm --filter @mimimilli/client build で移行前のバンドル実測(全JS合計/初期チャンク別gzip)が記録されている
- [x] #5 既存挙動に変化がなく pnpm check と pnpm test が通る
- [x] #6 collapse variantが確立されている(motion公式サポートのheight:0↔auto + opacity + ルートoverflow:hidden。gridTemplateRows直接アニメは不採用。内側の子レイアウトflex/gapは維持)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## バンドルベースライン (motion導入前, TASK-238計測)

コマンド: `pnpm --filter @mimimilli/client build`（コミット 55f9206、motion追加前）

- 全JS合計(gzip): 189.03 kB
  - index-BZfxxa2v.js（エントリ、同期）: 176.05 kB
  - FilesView-DxKiCBHK.js（React.lazy）: 6.32 kB
  - ScanModal-GsbmMD1e.js（React.lazy）: 3.66 kB
  - SettingsModal-BGnwRHwe.js（React.lazy）: 3.00 kB
- 初期チャンク(index.htmlから同期ロードされる分、gzip): 176.05 kB
- 参考: index-*.css（gzip）119.65 kB ※CSSは今回の比較対象外
- TASK-245で移行後の同コマンド実測と比較する

## fade退出のposition:absolute再現方式（確定）

`ml-presence-fade` の exit フェーズが行っていた「退出中は絶対配置してレイアウト膨張を防ぐ」を、motionの `exit` ターゲットに直接 `position/top/left/right` を埋め込む方式で再現する。

```
exit: { opacity: 0, position: "absolute", top: 0, left: 0, right: 0, transition: {...} }
```

- `width: 100%`（旧CSS）ではなく `left:0; right:0` を採用（親要素の実幅を知らなくても等価に伸縮するため。見た目は同一）
- 全 `fade` variant呼び出しで無条件に適用する（旧CSSも条件分岐なしだったため踏襲）。親要素に `position: relative/static` 以外の明示が無い箇所は旧実装からの継続で新規リスクではない
- `position` 等の非アニメーション値はmotionのtarget内に混ぜてよい（即時反映されるだけでアニメーション対象にはならない）という前提はmotion公式ドキュメントの `exit`/AnimatePresence運用パターンに基づく

## skipInitial 13箇所 対応表

新基盤では `{condition && <motion.div ... />}` の条件レンダー化＋`AnimatePresence` の `initial={false}`（AP境界単位）に移行する。以下は既存 `skipInitial` 呼び出しと、後続フェーズで対応するAP境界の対応表。

| # | ファイル:行 | 内容 | variant | 対応するAP境界（担当タスク） |
|---|---|---|---|---|
| 1 | TopBar.tsx:141 | DLsite一括取得「中止」ボタン | fade | TopBar内DLsite一括操作AP（TASK-239, AC#4） |
| 2 | FilesView.tsx:96 | パンくず「1つ上の階層へ」ボタン | colstack-width | FilesView階層ナビAP（TASK-243, AC#3） |
| 3 | PlayerDock.tsx:51 | バー型プレイヤー本体 | dock-bar-slide/switch | PlayerDock bar⇔popup切替AP（TASK-242, AC#4） |
| 4 | PlayerDock.tsx:72 | ポップアップ型プレイヤー本体 | dock-popup-scale | PlayerDock bar⇔popup切替AP（TASK-242, AC#4） |
| 5 | ScanModal.tsx:209 | RJコード未検出/データ不整合警告 | collapse | ScanModal警告AP（TASK-241, AC#3/#5） |
| 6 | ScanModal.tsx:241 | 新規検出した作品リスト | collapse | ScanModal新規作品AP（TASK-241, AC#3/#5） |
| 7 | ScanModal.tsx:342 | StatusRow: スキャン中の進捗表示 | fade | ScanModal StatusRow単一スロットAP（TASK-241, AC#1/#3, sync+退出absolute） |
| 8 | ScanModal.tsx:361 | StatusRow: 完了しましたヒント | fade | ScanModal StatusRow単一スロットAP（TASK-241, AC#1/#3） |
| 9 | ScanModal.tsx:370 | StatusRow: 最終スキャン日時 | fade | ScanModal StatusRow単一スロットAP（TASK-241, AC#1/#3） |
| 10 | ScanModal.tsx:270 | フッター「閉じてもバックグラウンドで続行します」 | fade | ScanModalフッターAP（TASK-241, AC#3） |
| 11 | ScanModal.tsx:279 | フッター「スキャンを中止」ボタン | fade | ScanModalフッターAP（TASK-241, AC#3） |
| 12 | ScanModal.tsx:291 | フッター「フルスキャン」ボタン | fade | ScanModalフッターAP（TASK-241, AC#3） |
| 13 | ScanModal.tsx:303 | フッター「スキャン開始」ボタン | fade | ScanModalフッターAP（TASK-241, AC#3） |

内訳: TopBar 1（TASK-239） / FilesView 1（TASK-243） / PlayerDock 2（TASK-242） / ScanModal 9（TASK-241）（合計13、既存カウントと一致）。
各担当タスクのAC文言の「initial={false} N箇所消化」と行数が一致することを確認済み（TASK-241 AC#3=9箇所、TASK-242 AC#4=2箇所、TASK-239 AC#4=1箇所、TASK-243 AC#3=1箇所）。
TASK-240（軸値選択UIの手動値退避解消）はskipInitial 13箇所には含まれない（対象がAxisQuickOverlay/AxisValuePopoverPanel/FilterChipAddButton/AxisColumnで、いずれもinitial={false}を使っていないため）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
motion@13.0.0を導入し、App.txの早期return4箇所をMotionConfig reducedMotion="user"で包んだ。presenceDurations.tsの後継としてuseMotionVariants.tsを新設し、純粋関数ビルダー9個(fade/fadeSlideUp/collapse/dockBarSlide/dockBarSwitch/dockPopupScale/popoverScale/colstackWidth/previewSlide)とそれを束ねるuseMotionVariants()フックのペアで構成。delayを含む全パラメータがtiming()経由で、transition.delay直書きの余地がない。値はshell.cssの全9 variantを踏襲。motion付属のuseReducedMotion()はマウント時スナップショット+モジュールシングルトンでOS設定変更に追随せずテスト間汚染もするため使わず、useSyncExternalStore+matchMedia直接購読の自前実装にした。旧CSSが全variantで適用していた退出中pointer-events:noneをexitターゲットにbakeし、inertとの多重防御を維持。collapseはheight:0↔auto+opacity+呼び出し側overflow:hidden。fade退出はexitにposition:absolute/top/left/rightを埋め込む。バンドルベースライン(移行前)は全JS合計gzip 189.03kB / 初期チャンク176.05kB。
<!-- SECTION:FINAL_SUMMARY:END -->
