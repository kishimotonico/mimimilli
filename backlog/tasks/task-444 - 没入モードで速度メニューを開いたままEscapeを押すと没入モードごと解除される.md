---
id: TASK-444
title: 没入モードで速度メニューを開いたままEscapeを押すと没入モードごと解除される
status: To Do
assignee: []
created_date: '2026-09-09 16:12'
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
- [ ] #1 没入モードで速度メニューを開いた状態の Escape が、速度メニューだけを閉じる
- [ ] #2 速度メニューを開いていない状態の Escape は従来どおり没入モードを解除する
- [ ] #3 Escape の階層の扱いが docs/design-system.md の記述と一致している
<!-- AC:END -->
