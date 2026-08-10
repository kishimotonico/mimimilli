---
id: TASK-250
title: useMotionVariantsのvariantをspread可能にしAP境界の定型配線を削る
status: Done
assignee: []
created_date: '2026-08-08 07:17'
updated_date: '2026-08-08 08:16'
labels: []
dependencies: []
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
motion移行の設計レビュー(Codex + 検証担当の独立検証)で判明した設計負債。

現在のvariantビルダーは {initial, animate, exit} を返し、呼び出し側が3プロパティを個別に展開する。その結果、AP境界の子コンポーネントは毎回「useIsPresent() → variant取得 → inert={!isPresent} + initial/animate/exit の3行展開」という定型配線を手書きしている。

client/src/features/scan/ui/ScanModal.tsx の ScanCancelButton(495) / ScanFullScanButton(515) / ScanStartButton(535) は5〜6行がほぼ完全に同一で、差分は onClick・className・アイコン・ラベルのみ。同ファイルの他6コンポーネント(StatusRowScanning / StatusRowCompleted / StatusRowLastScan / ScanWarnings / ScanNewWorks / ScanFooterHint)も同じ3行を繰り返している。移行によるプロダクションコード +325行の主因がこれ。

variantをspread可能な形(MotionProps相当)にすれば inert={!isPresent} {...v} の2行に減らせる。

ADR-0014原則5(汎用ラッパー禁止)には抵触しない。原則5が禁じているのはAnimatePresence相当のマウントライフサイクルを隠す汎用機構(TASK-156でTransitionPresenceの自作がレビュー5巡で破綻した教訓)であって、motionプロパティの機械的な配線を助けることまでは意図していない。着手時はこの境界を守り、AnimatePresenceの制御を隠す方向へ広げないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 useMotionVariantsのvariantがspread可能な形になり、呼び出し側が個別プロパティを展開しなくてよい
- [x] #2 ScanModal.tsxの9つのAP境界コンポーネントが新しい形に移行し定型配線が削減されている
- [x] #3 AnimatePresenceのマウント制御を隠す汎用ラッパーを作っていない(原則5を維持)
- [x] #4 既存の見た目・挙動に変化がなく pnpm check・pnpm test・pnpm test:smoke が通る
- [x] #5 ScanModal以外の8箇所(TopBar/Toast/PlayerDock2/LibraryView/FilesView/FilterChipAddButton/AxisValueQuickList/AxisValuePopoverPanel/AxisQuickOverlay)のうち同一パターンのものも新しい形へ移行している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
MotionVariant を Pick<MotionProps, "initial"|"animate"|"exit"> へ変更し、AP境界17箇所を {...v} の spread へ移行（11ファイル・純減64行）。ビルダーの返す値（duration/easing/target）は不変。inert={!isPresent} と useIsPresent() は原則3どおり各コンポーネントに残した。検証: pnpm check 通過、pnpm test（server 505 / client 773）通過、pnpm test:smoke 10件通過。spread と panelHandlers 等の併用箇所でキー衝突がないことを確認済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
useMotionVariants の variant を spread 可能な型に変え、AnimatePresence 境界の initial/animate/exit 個別展開を全17箇所で {...v} へ置換した。汎用ラッパーは作らず（ADR-0014 原則5）、配線の短縮のみ。見た目・挙動は不変で check/test/smoke すべて通過。
<!-- SECTION:FINAL_SUMMARY:END -->
