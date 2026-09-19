---
id: TASK-437
title: 再生速度メニューをusePopoverDismissalの閉じ方へ収束させる
status: Done
assignee: []
created_date: '2026-09-07 20:24'
updated_date: '2026-09-09 16:22'
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
- [x] #1 usePopoverDismissalがスクロールとフォーカス外しでの自動クローズを、呼び出し側が選べる形で提供する
- [x] #2 PlaybackRatePickerが自前のリスナーを持たず、usePopoverDismissal経由で閉じる
- [x] #3 速度メニューの外側クリック・Escape・スクロール・フォーカス外しでの閉じ方が3面（popup・再生中タブ通常・没入）で一致する
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 既存の呼び出し側5箇所（BarVolumePopover・LibrarySortMenu・WorkPlayButton・NotificationBell・AncestorStack/EllipsisSpine）の閉じ方の挙動が変わらない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AncestorStack（EllipsisSpine）での実スクロール確認について（2026-09-10、統括判断で対応なし）: 省略スロットを出せる唯一のパス（特典フォルダー）が new-work・large 両シナリオとも固定2ファイルで、リストが display:flex の空き埋めにより scrollHeight と clientHeight が常に一致するため、構造的にオーバーフローを作れず実スクロールでの確認ができなかった。除外ではなく検証の限界。間接証拠として、この呼び出しは LibrarySortMenu と同一の形（closeOnScroll/closeOnFocusOut を渡さない {isOpen, onClose, anchorRef} のみ）で、LibrarySortMenu 側は実スクロールで無変化を確認済み。usePopoverDismissal 内は if (!isOpen || !closeOnScroll) return; でリスナー自体を登録しないため、コード経路は同一。フィクスチャへのファイル追加は行わない。
<!-- SECTION:NOTES:END -->
