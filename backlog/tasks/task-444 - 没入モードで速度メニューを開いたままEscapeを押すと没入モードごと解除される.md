---
id: TASK-444
title: 没入モードで速度メニューを開いたままEscapeを押すと没入モードごと解除される
status: Done
assignee: []
created_date: '2026-09-09 16:12'
updated_date: '2026-11-27 14:09'
labels:
  - ui
  - player
  - bug
dependencies: []
priority: medium
ordinal: 465000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-437 の検証中に発見。TASK-437 が持ち込んだ退行ではなく既存の挙動（ベース比較で実測確認済み）。

没入モードで再生速度メニューを開いた状態で Escape を押すと、速度メニューが閉じるのと同時に没入モード自体も解除される。Escape は最も内側の階層だけを閉じるべきで、1回の押下で2階層戻るのは想定外。

原因: useNowPlayingImmersiveShell の document レベル keydown リスナーが Escape に stopPropagation せず消費する設計。速度メニュー側の実装（TASK-437 前の window 直張り／TASK-437 後の floating-ui 経由）にかかわらず発生する。

ベース比較の実測（同一操作列: ブランクから→ライブラリで作品選択→最初から再生→再生中タブ→没入モード→速度ピルでメニューを開く→Escape）:

  ベース（017ba09）: {immersivePresent: false, menuItems: 0, rateExpanded: "false"}
  TASK-437 適用後  : {immersivePresent: false, menuItems: 0, rateExpanded: "false"}

完全に同一で、既存の挙動と確定。

TASK-428.13 が定めた Escape の階層契約（docs/design-system.md の「グローバルショートカット / Escape」節）と照らして、どちらが正しいかを決めたうえで直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 没入モードで速度メニューを開いた状態の Escape が、速度メニューだけを閉じる
- [x] #2 速度メニューを開いていない状態の Escape は従来どおり没入モードを解除する
- [x] #3 Escape の階層の扱いが docs/design-system.md の記述と一致している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-529（Ark UI のメニュー）の後の master（88549452）で、フィクスチャ new-work・CDP 合成キーで実測。没入モードで速度メニューを開いたまま Esc: クリック開き・キーボード開きとも 10/10 でメニューだけ閉じ、没入モードと層は残り、フォーカスは速度ピルへ戻った。続けて Esc、またはメニューなしの Esc は 10/10 で層ごと閉じ、フォーカスは再生バーの「再生中を開く」へ戻った（body を経由しない）。AC#2 の「没入モードを解除する」は、現行仕様（design-system.md: Esc は通常・没入のどちらでも層ごと閉じ、没入の切り替えはボタンだけ）どおり層ごと閉じることで満たす。起票時の原因（useNowPlayingImmersiveShell の document の Esc リスナー）は現コードに無い
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
コード変更なし。TASK-529 で速度メニューが Ark UI のメニューになり、Esc を capture 段で先に受けて preventDefault するため、層側（NowPlayingLayer の defaultPrevented 判定）が反応しなくなって解消していた。master で各10回の実測で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
