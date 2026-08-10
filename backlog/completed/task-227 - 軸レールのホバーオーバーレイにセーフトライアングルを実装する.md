---
id: TASK-227
title: 軸レールのホバーオーバーレイにセーフトライアングルを実装する
status: Done
assignee: []
created_date: '2026-08-07 08:18'
updated_date: '2026-08-07 08:38'
labels: []
dependencies: []
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ検索の軸レール（CV・サークル等）のホバーで開くクイックオーバーレイへ、トリガーから斜めにポインタを移動すると途中で閉じたり別軸に切り替わったりする。原因は (1) パネルが垂直クランプでトリガー行から上下にずれ、移動経路が他の軸行の上を通る、(2) 各軸行が個別の useHoverIntent を持ち、経路上の行が200msで開きを横取りし、元の行の150msクローズが先に発火する構造（client/src/features/library/ui/AxisColumn.tsx:133-141）。closeDelay延長では解決しないため、セーフトライアングル（参考: https://ics.media/entry/260803/）を実装する。

設計方針（統括決定）:
- CSSのclip-path透明シールド方式ではなく、JSでのポインタ座標×三角形内判定方式を採る（ポータル+fixedパネル・クリック透過・他行のpointerenter抑止を素直に扱えるため）
- 既存の per-row useHoverIntent（shared/lib/useHoverIntent.ts）＋親の開閉一元管理という分担を見直し、AxisColumn側で「どの行がホバー中か・セーフトライアングル判定・他行の開き抑止」を一元管理するグループコーディネーター型の共通フックを shared/lib に新設して置き換えてよい（破壊的変更OK）
- 三角形は「トリガーを離れた時点のポインタ位置（頂点、pointermoveごとに更新して縮める）」と「パネルの近接辺の上下角（数px のパディング付き）」で構成。パネル矩形は useAnchoredPopover のレイアウト結果から得る
- セーフトライアングル内にいる間: 現オーバーレイのクローズを保留し、他の軸行の open 要求を抑止する
- 逃げ道: 三角形内でもポインタが約300ms静止したら抑止を解除し、その位置の行への切り替えを許可する
- タッチ環境ではホバー経路が存在しないため考慮不要（既存のpointerイベントベースを維持）

useHoverIntent が提供していた機能（開200ms・閉150msの遅延、pointerenter/pointerleave、トリガーとパネルのタイマー共有、ポータル越しのpanelハンドラ受け渡し）を列挙し、置き換え後も失われないこと。docs/design-system.md のホバーオーバーレイ規約（useHoverIntentを使う旨）の更新も含む。関連: docs/adr/0012-library-axis-as-value-browse.md §7
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 軸レールのトリガーからクイックオーバーレイへ斜め移動する際、他の軸行の上を通過してもオーバーレイが閉じない・別軸に切り替わらない
- [x] #2 セーフトライアングル内でもポインタが約300ms静止した場合は、その軸行への切り替えが行われる
- [x] #3 共通機構は shared/lib に置き、既存 useHoverIntent の機能（開閉遅延・pointerイベント・トリガーとパネルのタイマー共有）が失われていない
- [x] #4 docs/design-system.md のホバーオーバーレイ規約が新機構に合わせて更新されている
- [x] #5 三角形内判定の幾何ロジックにユニットテストがある
- [x] #6 pnpm check と変更範囲のテストが通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
per-rowのuseHoverIntentをグループコーディネーター型useHoverGroupCoordinator（shared/lib）へ置き換え、JSのポインタ座標×三角形内判定でセーフトライアングルを実装。三角形内では現オーバーレイのクローズ保留＋他行のopen抑止、約300ms静止で切り替え許可。幾何判定はpointInTriangleとして純関数化しテスト追加。レビュー指摘のpointermoveリスナー参照不一致リークは安定参照化で修正し退行テスト追加。pnpm check・テスト全通過、検証担当のブラウザ検証（斜め移動維持・静止切替・クリック/Escape/外側クリック/ArrowRight退行なし）OK
<!-- SECTION:FINAL_SUMMARY:END -->
