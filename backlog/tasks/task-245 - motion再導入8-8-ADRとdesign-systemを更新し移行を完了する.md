---
id: TASK-245
title: 'motion再導入(8/8): ADRとdesign-systemを更新し移行を完了する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 17:16'
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
