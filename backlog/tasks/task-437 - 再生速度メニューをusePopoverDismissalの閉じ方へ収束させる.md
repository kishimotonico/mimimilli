---
id: TASK-437
title: 再生速度メニューをusePopoverDismissalの閉じ方へ収束させる
status: To Do
assignee: []
created_date: '2026-09-07 20:24'
labels:
  - ui
  - player
  - refactor
dependencies: []
ordinal: 458000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.23 がポップオーバーの閉じ方を usePopoverDismissal へ統一したが、再生速度メニューだけが自前の pointerdown / keydown / scroll / focusout リスナーを使ったまま残っている。TASK-428.16 で速度ピッカーを client/src/features/player/ui/PlaybackRatePicker.tsx として共有コンポーネント化した結果、この不整合の適用箇所が PopupContent の1箇所から、PopupContent・PlayerTransportControls・NowPlayingImmersiveMiniControls の3箇所へ広がった。

TASK-428.16 の時点で収束させなかったのは、usePopoverDismissal がスクロールとフォーカス外しでの自動クローズを持たず、切り替えると既存の単体テスト3件が壊れるため。つまり不足しているのは共通フック側の機能であり、呼び出し側を無理に寄せるのではなく usePopoverDismissal を拡張して収束させる。

usePopoverDismissal を使う既存箇所（BarVolumePopover・LibrarySortMenu・WorkPlayButton・NotificationBell）の挙動を変えないこと。スクロール・フォーカス外しでの自動クローズは、必要な呼び出し側だけが有効化できる形にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 usePopoverDismissalがスクロールとフォーカス外しでの自動クローズを、呼び出し側が選べる形で提供する
- [ ] #2 PlaybackRatePickerが自前のリスナーを持たず、usePopoverDismissal経由で閉じる
- [ ] #3 既存の呼び出し側（BarVolumePopover・LibrarySortMenu・WorkPlayButton・NotificationBell）の閉じ方の挙動が変わらない
- [ ] #4 速度メニューの外側クリック・Escape・スクロール・フォーカス外しでの閉じ方が3面（popup・再生中タブ通常・没入）で一致する
- [ ] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
