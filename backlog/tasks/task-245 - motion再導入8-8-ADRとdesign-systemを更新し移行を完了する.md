---
id: TASK-245
title: 'motion再導入(8/8): ADRとdesign-systemを更新し移行を完了する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 18:19'
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
- [ ] #1 docs/design-system.mdのMotion節が新基盤前提に書き換わっている
- [ ] #2 完了時の pnpm check && pnpm test フルと pnpm --filter @mimimilli/client build の実測が記録されている
- [ ] #3 ADR-0014の帰結にバンドル増分の実測値が追記されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## バンドル計測の前提（統括記録・2026-08-08）

TASK-238が記録した移行前ベースライン（コミット 55f9206、motion/clsx/tailwind-merge のいずれも未導入）:
- 全JS合計(gzip): 189.03 kB
- 初期チャンク(gzip): 176.05 kB
- 内訳: index(entry) 176.05 / FilesView(lazy) 6.32 / ScanModal(lazy) 3.66 / SettingsModal(lazy) 3.00

TASK-246+247+238 マージ後の中間実測（コミット e9b57bc）:
- 全JS合計(gzip): 198.56 kB（+9.53 kB / +5.04%）
- 初期チャンク(gzip): 185.58 kB（+9.53 kB / +5.41%）
- lazyチャンク3つはベースラインと完全一致。増加分はすべてエントリチャンク側

**この中間値を最終値として使わないこと。** 計測時点では App.tsx が MotionConfig を import しているだけで、AnimatePresence と motion.div は client/src のどこからも import されていない（TASK-239〜243 が実装する）。したがって motion の実フットプリントはこの数値に反映されておらず、フェーズ2〜6の完了後に必ず測り直す。

ADRへ追記する際は次の3点を分けて書くこと:
1. 移行前ベースライン（55f9206）
2. 移行後の最終実測（TASK-244完了後）
3. 増加分のうち clsx+tailwind-merge（TASK-246）由来の分は motion の増分ではない旨の注記

参考: TASK-156 で motion を削除したときの実測は gzip 211KB→169KB（-42KB）。今回の増分がこれと大きく食い違う場合は、motion のバージョン差（当時 framer-motion 系、現在 motion@13）による tree-shaking 改善の可能性があるので、その旨をADRに記す。
<!-- SECTION:NOTES:END -->
