---
id: TASK-529.3
title: メニュー・ポップオーバーの共通層を Ark に寄せて整理し、使い方を一通りにする
status: Done
assignee: []
created_date: '2026-11-27 11:30'
updated_date: '2026-11-27 12:07'
labels:
  - ui
dependencies: []
documentation:
  - backlog/docs/doc-12 - TASK-529-統合ブランチ最終レビュー（2026-11-27）.md
parent_task_id: TASK-529
priority: high
ordinal: 652000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
統合ブランチの最終レビュー（doc-12）で、共通層（shared/ui/layer・menu・popover）に Ark/zag の判定の再実装と、呼び出し側ごとに違う使い方が見つかった。共通層の API をここで一通りに決め、全呼び出し箇所をそれに合わせる。呼び出し側の個別の補修（UnregisteredFooter の▾、パンくずの id、WorkTagEditor、ScanSidebar ほか）は TASK-529.4。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 isInsideOwnLayerTree・popoverTriggerIds・isInsideOwnMenuTree の自前のツリー判定が無く、zag の判定（ポップオーバーは onFocusOutside の上書きなし、メニューは onInteractOutside の defaultPrevented）に任せている。重なりのテストが通る
- [x] #2 メニューのトリガーは共通層の MotionMenuTrigger で描き、triggerProps は公開しない。gutter の既定はメニュー・ポップオーバーとも共通層が持ち、出現の起点は placement から決まる（16箇所の origin の手書きが無い）
- [x] #3 フォーカスを残したまま無効にするトリガーの作り方が一通りで、メニュー・ポップオーバーのフックの disabled が止める処理と aria-disabled・data-disabled を返す。呼び出し側の onOpenChange の二重ガードと RowMenu の手書きが無い
- [x] #4 Ark の DOM に触るセレクタと content ごとの登録が shared/ui/layer の1か所にあり、ハンドルの公開面は開閉状態・closeAndReturn・focusInitial などの利用者向けだけ（menu.menu.api.open の二重たどりが無い）。メニューとポップオーバーで Context の組み方がそろっている
- [x] #5 service.send の利用が restoreFocus:false の CLOSE に限られ、ADR-0043 にその依存と Ark 更新時に確かめる経路が書かれ、design-system.md が実装と一致している
- [x] #6 pnpm check && pnpm test と pnpm test:smoke が通る
- [x] #7 ポータルした層から React の木を伝うイベントの扱いが共通層の1つの規則（層ではネイティブもReactも止めず、受ける祖先が isFromPortaledLayer で弾く）で、BarVolumePopover の stopPropagation が無い
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装メモ（task-529.3-layer）
- 出現の起点: zag が positioner に出す --transform-origin を layerScale の既定にした（実ブラウザ計測: bottom-end で 167px -6px、トリガーを画面下へ置いて flip した top-end で 167px 268px。CSS変数は content の inline style で解決された）。origin prop は全箇所から削除。
- useGlobalShortcuts: capture は player-control の Space だけに絞り、ArrowLeft/Right と通常の Space は元の bubble に戻した（Ark のトリガーより先に止める必要があるのは Space だけのため）。層内のイベントは共通層で止めるので bubble でも層の中のキーは届かない。
- zag に任せて落ちたテスト: なし（重なり・別メニュー移動・外へのフォーカス移動はそのまま通過）。
- 削除・緩和したテスト: isInsideOwnMenuTree の単体テスト（関数ごと削除、代わりに既存の重なりテストと外へのフォーカス移動テスト）、menuLayer の grid-cols と motionPopover の toHaveClass（クラス文字列のみ）、usePopupDrag の「ポータルしたメニュー項目からは始めない」（ガード削除。代わりに menuLayer/motionPopover の『ポータルした中身は祖先へ伝えない』）、menuLayer の if(menu) 条件付き期待は同期取得の not.toBeNull 相当へ。
- 追加: 無効トリガー（メニュー・ポップオーバー）のポインター/キーのテスト、IconButton softDisabled のテスト、useElementWidth.test.tsx へ移設。
- FilterChipAddButton の1段目は role=group も prefer-tag-over-role に掛かるため fieldset にした。
- SplitButton 主ボタン・ScanSidebar 中止ボタンの aria-disabled+onClick ガードは softDisabled と同じ形のため変更なし。
- 結果: pnpm check OK、pnpm test 199 files / 1811 tests pass、pnpm test:smoke 74 pass（初回 73 + library の1件をロケータ修正後に再実行して通過）。

レビュー差し戻し対応: 層の stopPropagation をやめ isFromPortaledLayer(layer/layerEvents.ts) を祖先側のガードにした。ガードを入れた祖先: usePopupDrag（pointerdown・dblclick、PlayerDock）、BarContent 本体の onClick。洗い出し（onPointerDown/onDoubleClick/onClick/onKeyDown を持つ非ボタン）で他の層の祖先は、NowPlayingImmersiveMiniControls の wrapper（既に stopPropagation 済み）、GroupValueQuickList の onKeyDown（層の内側の要素で層を含まない）、TopBar/TagCombobox の input のみで追加不要。useGlobalShortcuts は層の中（LAYER_CONTENT_SELECTOR）のキーを除外。player-control の Space の capture は、Ark のメニュートリガーが keydown で開くため先取りが要る（popover はキーアップの click）ので維持。削除した『危険な項目は区切り線の下に置く』は RowMenu.test.tsx に戻した。isFocusLost は shared/lib へ。MotionPopover の id は ref をやめ popover の id から直接解決。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
共通層（layer/menu/popover）から zag の判定の再実装を消し、MotionMenuTrigger・MotionPopoverTrigger、disabled、gutter と --transform-origin の既定、ハンドルの公開面を一通りにした。層のイベントは止めず、祖先側で isFromPortaledLayer により弾く規則にした（層側で止める案は ⌘K 等の window リスナーを壊したため不採用）。ADR-0043・design-system.md を更新。check・test（1814）・smoke（74）成功、Opus レビュー2回で合格。
<!-- SECTION:FINAL_SUMMARY:END -->
