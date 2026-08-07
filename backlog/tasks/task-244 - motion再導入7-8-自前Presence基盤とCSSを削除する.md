---
id: TASK-244
title: 'motion再導入(7/8): 自前Presence基盤とCSSを削除する'
status: Done
assignee: []
created_date: '2026-08-07 17:01'
updated_date: '2026-08-07 21:39'
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
- [x] #1 usePresence・Presenceへの参照が0でファイルが削除されている
- [x] #2 shell.cssの削除がセレクタ単位リストに従っており維持対象のCSSに差分がない
- [x] #3 クエリ購読の目視総点検の結果がタスクノートに記録されている
- [x] #4 pnpm check・pnpm test・pnpm test:smoke が通る
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

## 実施結果（TASK-244実装担当）

### 削除したファイル
- client/src/shared/ui/usePresence.ts
- client/src/shared/ui/Presence.tsx
- client/src/shared/ui/presenceDurations.ts
- client/tests/unit/presence.test.tsx

着手前に `rg -n "usePresence|<Presence|presenceDurations" client/src/` で残存が定義ファイル自身のみであることを確認済み（消費者0件）。

### shell.css 削除セレクタ一覧（3356〜3562行、削除前に列挙してから実施）
- `.ml-presence-fade`（transition本体・enter/exit・shown・exit時position:absolute）
- `.ml-presence-fade[data-phase="exit"], .ml-presence-fade-slide-up[...], .ml-presence-collapse[...], .ml-presence-dock-bar[...], .ml-presence-dock-popup[...], .ml-presence-colstack[...]` の複合pointer-events規則（全構成セレクタがml-presence系のため丸ごと削除）
- `.ml-presence-fade-slide-up`（transition・enter/exit・shown）
- `.ml-presence-collapse`（gridトリック本体・shown）
- `.ml-presence-collapse__inner`（Presence.tsx内でのみ参照されており他消費者なしのため削除）
- `.ml-presence-dock-bar`（transition・enter/exit・shown・--switch・--wait-enter）
- `.ml-presence-dock-popup`（transform-origin+transition・enter・exit・shown・--wait-enter、直前のtransform-originコメントも削除）
- `.ml-presence-popover-scale`（transition・enter・exit・shown）
- `.ml-presence-colstack`（width/opacity/overflow/transition・shown）
- `.ml-presence-preview`（transform+transition・shown、直前のADR-0012コメントも削除）
- 見出しコメント `/* ── Presence transitions (motion/react 置換) ─────────────── */`
- reduced-motion一括ブロック内の `.ml-presence-fade, .ml-presence-fade-slide-up, .ml-presence-collapse, .ml-presence-dock-bar, .ml-presence-dock-popup, .ml-presence-popover-scale, .ml-presence-colstack,` の7行（ブロック自体・維持対象4セレクタは残置）

削除後 `rg -n "ml-presence" client/src/` で0件を確認。

### 維持対象の差分確認方法
`.mll-bar { position: relative }`（TASK-239追加）、`.mll-qlist__sort` 系（1601〜1644行）、`.mle-colstack` / `.mle-colstack__edges` / `.mle-colstack__label`（1820〜1900行）は削除範囲（3356〜3562行）の外にあり無変更。削除範囲内の `.mle-colstack__edges[data-pulse="enter"]` と `.mle-colstack__edges { transition }`、`.ml-file-col-enter` 本体・data-dir修飾子・keyframes2本、reduced-motionブロック内の該当4セレクタは削除前後で1文字も変更していないことを目視確認（Edit差分に含まれていない）。

### AC#3 クエリ購読の目視総点検
対象: features/library（AxisQuickOverlay / AxisValuePopoverPanel / useLibraryQueries / useAxisFacetsQuery / LibrarySortMenu / AxisValueQuickList / FilterChipAddButton / FilterChipBand）、features/scan（ScanModal / ScanRuntime）、features/player（usePlayer / PlayerDock関連 / usePlayerActions / playerController / audioEngine / FullScreenPlayer）、features/files（FilesView / RegisterWorkDialog / FilePreview）、app（App.tsx / NotificationBell）、shared全体。

`rg -n "\benabled\s*:"` で全 `.ts`/`.tsx` を洗い出した結果、該当は以下の3箇所のみ:
- `useAxisFacetsQuery.ts:18` `enabled: axis !== null` — 呼び出し元（AxisQuickOverlay.tsx:52, AxisValuePopoverPanel.tsx:42）はいずれも `axis as FacetAxisId`（TASK-240でnull三項を解消済み）で渡しており、開閉stateとは無関係
- `LibrarySortMenu.tsx:49` `enabled: onSmartAxis` — スマート軸フィルタの有無に連動し、AP開閉stateとは無関係（TASK-240レビューで判定済み）
- `useLibraryQueries.ts:187` `enabled: nav.selectedWorkId !== null` — 作品プレビュー選択state（ナビゲーション状態）であり、AP開閉stateとは無関係（TASK-240レビューで判定済み）

加えて `isOpen ? … : null` / `open ? … : null` 型の三項をquery引数に渡す箇所、および features/scan・features/player・features/files・app 配下の全 `useQuery`/`useSuspenseQuery`/`useMutation` 呼び出しを個別確認したが、開閉stateをフック引数・optionsに流し込む箇所は上記3件以外に見つからなかった。**懸念なし。**

### テスト・ブラウザ確認結果
- `pnpm check`: 全通過（oxlint / oxfmt --check / tsc×3 いずれもエラーなし）
- `pnpm test`: 505 pass / 0 fail（Vitest, 56ファイル）、772 tests / 102 test files 全通過
- `pnpm test:smoke`: 10 tests 全通過（library.smoke.spec.ts, 2.7m）
- ブラウザ目視確認（agent-browser --session task244、fixtureアダプタ内蔵vite@4177番ポートで一時起動、確認後プロセス終了済み）:
  - ライブラリ トップ・タグ軸の値一覧（AxisValueQuickList） 正常表示
  - 並び替えメニュー（LibrarySortMenu ポップオーバー） 開閉正常
  - フィルタチップ列・すべてクリア 正常表示
  - 作品プレビュー（fade + preview-slide） 正常表示・スライドイン確認
  - ファイルモード colstack（library階層バー、幅46px折り畳み）・ml-file-col-enter アニメ 正常動作
  - スキャンダイアログ（開始→完了、新規検出作品セクションのcollapse表示） 正常表示
  - Toast（DLsite一括取得通知） 正常表示
  - PlayerDock bar（下部ドック、入場スライド）・popup（展開後のscale切替、シークバー等） 正常切替
  - 崩れ・見切れ・意図しないポインタイベント漏れは確認されなかった
>>>>>>> feat/task-244-motion
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
自前Presence基盤(usePresence.ts 90行 / Presence.tsx 88行 / presenceDurations.ts 16行)とpresence.test.tsx(111行)を削除し、shell.cssの.ml-presence-*系セレクタをセレクタ単位で削除した。維持必須の.mll-bar{position:relative}(TASK-239追加のpositioned ancestor)・.mll-qlist__sort・.mle-colstack・.mle-colstack__edges・.ml-file-col-enter・装飾系keyframesは全て残存を確認。reduced-motion一括ブロックは削除対象と維持対象が同居していたため、ブロック自体は残して.ml-presence系7セレクタのみを間引き、構文の健全性も確認した。presence.test.tsxの6件はPlayerDock固有1件がplayerDock.test.tsxへ移管済みで、残る5件は廃止されたメカニズム自体の単体テスト。テスト件数778→772の-6件が削除分と一致し巻き添えなし。AC#3のクエリ購読目視総点検は全ディレクトリを対象にenabled:とisOpen三項パターン、カスタムフック経由の開閉state流入まで捜索し該当0件。
<!-- SECTION:FINAL_SUMMARY:END -->
