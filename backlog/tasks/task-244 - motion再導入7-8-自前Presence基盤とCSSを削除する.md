---
id: TASK-244
title: 'motion再導入(7/8): 自前Presence基盤とCSSを削除する'
status: To Do
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 21:20'
labels: []
dependencies:
  - TASK-239
  - TASK-240
  - TASK-241
  - TASK-242
  - TASK-243
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
確定仕様は docs/adr/0014-motion-reintroduction-presence-removal.md のCSS削除確定事項（フェーズ7）。usePresence.ts・Presence.tsx・presenceDurations.tsを削除。shell.cssはセレクタ単位の削除リスト（.ml-presence-*系の状態セレクタ・[data-phase]複合・modifier・退出中pointer-events規則・reduceブロック内の該当行。collapseはgridトリックのみ削除し子レイアウトflex/gapは維持。実施時に行番号を再確認）で削除し、.mle-colstack__edges・.ml-file-col-enter・装飾系keyframesとそれらのreduce指定は維持。presence.test.tsxはrapid toggle等の移管完了(TASK-242)を確認してから削除。旧Presence利用10ファイルで「フック引数/optionsに開閉stateを渡している呼び出し」を目視総点検（機械的grep不可）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 usePresence・Presenceへの参照が0でファイルが削除されている
- [ ] #2 shell.cssの削除がセレクタ単位リストに従っており維持対象のCSSに差分がない
- [ ] #3 クエリ購読の目視総点検の結果がタスクノートに記録されている
- [ ] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 着手前提条件（充足済み・2026-08-08確認）

旧Presenceの消費者は**ゼロ**。`rg -n "usePresence|<Presence|presenceDurations" client/src/` のヒットは定義ファイル自身（usePresence.ts / Presence.tsx / presenceDurations.ts）のみ。TASK-239/240/241/242/243 で8ファイル全ての移行が完了した。

## 削除可（消費者ゼロを確認済み）

- `client/src/shared/ui/usePresence.ts` / `Presence.tsx` / `presenceDurations.ts` 本体
- `client/tests/unit/presence.test.tsx`（TASK-242レビューで削除可と結論。失われる汎用5件はメカニズムごと消えるため問題なし。PlayerDock保証は playerDock.test.tsx / playerDockPopupListeners.test.tsx が完全カバー）
- shell.css: `.ml-presence-collapse` / `.ml-presence-collapse__inner`（3398-3417）
- shell.css: `.ml-presence-colstack`（3484-3495）/ `.ml-presence-preview`（3499-3501）
- shell.css: `.ml-presence-fade` / `.ml-presence-dock-bar` / `.ml-presence-dock-popup` / `.ml-presence-popover-scale` 系（3358〜3505付近）

## 維持必須（消すと壊れる）

- `.mll-bar { position: relative }`（shell.css:97付近）— **TASK-239が新規追加**。fade退出のposition:absoluteが効くためのpositioned ancestor。Presence系ではない
- `.mll-qlist__sort`（1615-1620、`display:flex; gap:4px; padding:4px 8px; border-bottom`）— TASK-243の新方式は外側の無地ラッパーがクリップする前提で、このスタイル自体は現役
- `.mle-colstack`（1820-1828、`width:46px; overflow:hidden; border-right`）— colstackWidth variantの widthPx=46 と対応
- `.mle-colstack__edges` / `.ml-file-col-enter` / 装飾系keyframes（barwave/EQ/skeleton等）とそれらのreduced-motion指定 — ADR明記の維持対象

## reduced-motion一括ブロックの扱い（注意）

shell.css:3549-3561 のreduced-motion一括無効化ブロック内に `.ml-presence-collapse` `.ml-presence-colstack` と、**維持対象の `.mle-colstack__edges` `.ml-file-col-enter` が同居している**。**このブロック自体は消さず、対象セレクタだけ間引くこと。**

## 実施時の注意

行番号は実施時点で必ず再確認する（先行フェーズの変更で移動している可能性がある）。セレクタ単位の削除リストを作ってから着手すること。
<!-- SECTION:NOTES:END -->
