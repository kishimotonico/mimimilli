---
id: TASK-245
title: 'motion再導入(8/8): ADRとdesign-systemを更新し移行を完了する'
status: Done
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 21:57'
labels: []
dependencies:
  - TASK-244
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
移行完了処理（フェーズ8）。docs/adr/0014-motion-reintroduction-presence-removal.md は起票済みなので、バンドル増分の実測値(全JS合計/初期チャンク別gzip、pnpm --filter @mimimilli/client build で計測)をADRの帰結へ追記する。docs/design-system.mdのMotion節をMotionConfig/AnimatePresence前提に書き換え（AP境界の子切り出し+useIsPresentの用途限定規約、layout/layoutId禁止、reduced-motion仕様。詳細はADR-0014の移行原則）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/design-system.mdのMotion節が新基盤前提に書き換わっている
- [x] #2 完了時の pnpm check && pnpm test フルと pnpm --filter @mimimilli/client build の実測が記録されている
- [x] #3 ADR-0014の帰結にバンドル増分の実測値が追記されている
- [x] #4 削除済みのusePresence/Presence APIを現役として説明するコード内コメント3箇所(StackEdge.tsx:1 / PreviewPane.tsx:9 / AxisValueQuickList.tsx:41)が現行のAnimatePresence前提に更新されている
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## バンドル計測の前提（統括記録・2026-08-08）

### 計測系列

| 地点 | コミット | 全JS合計(gzip) | 初期チャンク(gzip) | 内容 |
|---|---|---|---|---|
| 移行前ベースライン | 55f9206 | 189.03 kB | 176.05 kB | motion/clsx/tailwind-merge いずれも未導入 |
| 中間1 | e9b57bc | 198.56 kB | 185.58 kB | 246+247+238。MotionConfigのみでAnimatePresence未使用 |
| 中間2 | f94a726 | 241.60 kB | 228.22 kB | +239/241/242。AnimatePresenceとmotion.divが実際に使われた最初の計測 |

ベースライン比: **全JS合計 +52.57 kB (+27.81%) / 初期チャンク +52.17 kB (+29.63%)**

中間1→中間2 の +43.04 kB が motion の実フットプリント。lazyチャンクはScanModalのみ 3.66→4.06 kB と微増し、他は不変。増加はほぼエントリチャンク側。CSSは gzip 119.65→119.66 kB でほぼ不変。

### 最終計測の注意

**上記はいずれも中間値。** TASK-240（ライブラリ値選択UI）とTASK-243（preview/colstack/collapse）が未反映で、TASK-244で自前Presenceと旧CSSが削除されると一部戻る。**TASK-244完了後に測り直すこと。**

### ADRへ追記する際の構成

1. 移行前ベースライン（55f9206）
2. 移行後の最終実測（TASK-244完了後）
3. 増加分の内訳注記: clsx+tailwind-merge（TASK-246）由来の分は motion の増分ではない。中間1の +9.53 kB がそれに相当し、motion 自体の増分は残り

### TASK-156との対比

TASK-156 で motion を削除したときの実測は gzip 211KB→169KB（-42KB）。今回の増分（現時点で +52.57 kB、240/243を加えるとさらに増える）は**削除時の-42KBを上回っている**。ADRは「-42KB相当の逆方向」と予測していたが実際はそれより大きい。motion@13 の tree-shaking が当時（framer-motion系）より改善しているという仮説は**成り立たなかった**ことになるので、ADRの帰結にはこの予測と実測の差を明記すること。バンドル増を承知で健全性を優先した判断の、実際のコストが予測より大きかったという事実を残す。
<!-- SECTION:NOTES:END -->
