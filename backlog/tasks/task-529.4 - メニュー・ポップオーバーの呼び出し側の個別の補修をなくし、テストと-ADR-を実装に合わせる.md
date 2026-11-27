---
id: TASK-529.4
title: メニュー・ポップオーバーの呼び出し側の個別の補修をなくし、テストと ADR を実装に合わせる
status: Done
assignee: []
created_date: '2026-11-27 11:30'
updated_date: '2026-11-27 13:41'
labels:
  - ui
dependencies:
  - TASK-529.3
documentation:
  - backlog/docs/doc-12 - TASK-529-統合ブランチ最終レビュー（2026-11-27）.md
parent_task_id: TASK-529
priority: high
ordinal: 653000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
統合ブランチの最終レビュー（doc-12）で、設計の前提が外れた箇所を呼び出し側の命令的な補修（capture 段の横取り、DOM の id 書き換え、ref cleanup の順序頼み、inert のタイミング頼み）で埋めていることが分かった。TASK-529.3 で整えた共通層の上で、宣言的な形か操作の起点で決める形に直し、テストの空振りと ADR の誤りを直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 未登録タブの▾は、項目選択ポップオーバーが開いているときに押すとポインターでもどのキー（Enter・Space・ArrowDown・ArrowUp）でもポップオーバーを閉じるだけで、メニューは開かない。UnregisteredFooter に capture 段のハンドラと ref フラグが無い
- [x] #2 パンくずの値のトリガー id は Breadcrumbs へ props で宣言的に渡し、DOM の id 書き換え・onReturnTargetLost・クラス名での探索・anchorEl と getAnchorRect の二重渡しが無い（基準がトリガーと違う #7 は ids.anchor）
- [x] #3 WorkTagEditor のトリガーは幅にかかわらず1つで、作り直しのフォーカス移しが無い。タグ追加ポップオーバーは WorkTagEditor と WorkEditTagsField で同じ部品を使う
- [x] #4 スキャンの開始・中止でボタンが入れ替わるとき、操作の起点でフォーカスを移し、inert のタイミングに頼らない
- [x] #5 menuLayer の空振りしうる期待とクラス文字列だけのテストが無く、aria-disabled のトリガー（SplitButton の主ボタンを含む）を押しても何も起きないことと、作品編集ダイアログ→タグ追加→候補の Esc が一段ずつ閉じることを smoke で確かめている
- [x] #6 ADR-0043 の未来形・未完了を完了と書いた記述（右クリックとの項目共有）・実装手順の積み上げが無く、pnpm check && pnpm test と pnpm test:smoke が通る
- [x] #7 FilterChipAddButton の1段目は div role=group（GroupValueQuickList と同じ理由の lint 抑止）で、ポップオーバー内のボタン一覧の見た目が1つのクラスにまとまっている。doc-12 の nit は直すか、対応なしの理由を実装メモに残している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-529.3 のレビューからの持ち越し: トリガー以外の『フォーカスを残して無効』（IconButton.softDisabled と、SplitButton の主ボタン・ScanSidebar の中止・WorkPlayButton.tsx:74 の手書き aria-disabled＋onClick ガード）を一通りにする。Button 側にも同じ仕組みを持たせるかをここで決める。

実装メモ（task-529.4-callsites、コミット 264cda24・テスト・docs の3本）
- ▾（AC1）: SplitButton に menuOpen/onMenuOpenChange（開閉を呼び出し側が持つ）。Footer は開く要求のとき pickerOpen なら picker を閉じるだけ。実ブラウザ（fixture scan-review）で、picker を開いた状態の▾をポインター・Enter・Space・ArrowDown・ArrowUp で押して全て『picker だけ閉じる・メニューは開かない・フォーカスは▾』。通常のキーボード open は先頭項目ハイライトのまま（制御でも壊れない）。外枠の capture 3本と ref は削除。unit は UnregisteredTab.test に5通り。
- パンくず（AC2）: Breadcrumbs.lastSegmentId、onNavigate は (index) のみ。GroupValuePopover は anchorEl・onReturnTargetLost・resolveReturnTarget 公開を削除（サイドバー側の openAnchorEl も hover coordinator から削除）。項目選択は ids.anchor に SplitButton の id。
- タグ追加（AC3）: TagAddPopover。インライン外側クリックは shared/ui/layer/useDismissOnOutsidePress。インラインの aria-expanded は unit で確認。
- スキャン（AC4）: ScanSidebar の runAndMoveFocus（await 後 flushSync、起点にフォーカスがあるか body のとき新ボタンへ）。実ブラウザで開始→中止ボタンへ28ms。制約: 中止後や自然完了で中止ボタンが消える遷移は操作の起点が無いのでフォーカスは dialog へ落ちる。
- softDisabled: shared/ui/softDisabled.ts を Button・IconButton が共有。SplitButton 主ボタン・中止ボタンを置換。WorkPlayButton:74 は手書きガードでなく disabled 属性＋冗長な aria-disabled だったので aria-disabled のみ削除（フォーカスを残す必要が無い）。
- nit 対応表: layerContainer/focusReturnTarget のセレクタ重複・MotionPopoverHandle の内部公開・context 非対称・useCloseOnAnchorScroll・親退出フック・useMotionVariants 名・テスト移設/共通層直組み・menuLayer 空振り・SplitButton JSDoc・import 離れ・MotionMenuHandle export 等は TASK-529.3 で済み。今回: FilterChipAddButton backOrClose 分岐/行見た目1クラス（popoverListItemClass）/fieldset 化、幅 className 統一、UnregisteredTab の data-row-menu・busy 順・ガード先頭・nextRowPathAfterLeaving 純粋化と lint 抑止削除、TopBar は data-search-shortcut-scope、focusListOnReturnAtom は戻り先が works でなければ立てない、prepareUnregister の引数削除（PatchScope が contents の div で ref）、WorkPlayButton 子コンポーネント化、LibrarySortMenu の as 削除、WorkTagEditor.test の非 null 断言削除、quick-overlay.css→quick-list.css。対応なし: focusListOnReturn の『一覧を表示しない別モードへ行った場合の残留』（isFocusLost ガードで実害なし）。N8（render 中 ref 書込）は 529.3 の useLayoutEffect 化で済み。
- 削除・緩和したテスト期待値: Breadcrumbs.test の onNavigate 第2引数（アンカー要素）を削除（引数自体を廃止）。useHoverGroupCoordinator.test の openAnchorEl 期待を削除（フィールド廃止）。代わりの保証は GroupValuePopover の基準がトリガー（LibraryBreadcrumbs.test の開閉・フォーカス復帰）。
- ADR-0043 86行目: 実ブラウザで測定（作品編集ダイアログ→タグ追加ポップオーバー→backdrop 5/5 でポップオーバーだけ閉じ dialog 残る）して書き換え。右クリック共有は未実装として完了から外した。
- 結果: pnpm check OK、pnpm test 202 files / 1819 tests pass（server 1383）、pnpm test:smoke 75 pass。

修正対応（統括指摘）: FilterChipAddButton の1段目は div role=group＋lint 抑止（GroupValueQuickList と同じ書き方）に戻した。先の対応表の『fieldset 化』は取り消し。ScanSidebar は runAndMoveFocus をやめ、入れ物（actionsRef の div）が onFocus で『フォーカスがあった』を立て、onBlur は relatedTarget が外かつ非 null のときだけ下ろす。inProgress が変わった layout effect で、立っていて、フォーカスが入れ物の中（退出中のボタン）か body なら新しいボタン（開始側は主ボタン）へ移す。操作でも自然完了でも1か所。unit は ScanSidebarFocus.test に3通り（開始→中止、中止の完了・自然完了→開始、外にあるとき奪わない）。実ブラウザで Enter の開始→中止ボタン(39ms)→自然完了で開始ボタンへ戻ることを確認。結果: check OK、test 203 files/1822 pass、smoke 75 pass（1回目は ERR_NETWORK_CHANGED の warmUp タイムアウト3件、該当ファイル再実行と全体の再々実行で通過）。

差し戻し対応2: ▾は非制御に戻し、useMotionMenu.interceptOpen（SplitButton.interceptMenuOpen）で開く操作を横取り（zag 制御モードは閉じるとき無条件に focusTrigger し restoreFocus:false が効かないため）。実ブラウザ: ▾を開いて行チェックボックスをクリック→フォーカスは行に残る、Tab で▾に引き戻されない、キーボード open の先頭ハイライト（ArrowDown 先頭・ArrowUp 末尾）、picker 表示中の▾をポインター/Enter/Space/ArrowDown/ArrowUp で押すと picker だけ閉じ▾にフォーカス（各3回）。WorkDetailPatchScope のラッパー div は残した: 描き直し後は実ブラウザで body へ落ちるのが遅れ isFocusLost では足りず（smoke の登録解除が落ちた）、描き直す前にフォーカスが詳細の中だったかを求める形にした。useDismissOnOutsidePress→useDismissOnOutsideInteraction（外への focusin でも閉じる、パネルから開いた層は内側扱い）。hover coordinator の el 受け渡しは削除。行の︙の Tab 調査: 529.2(c0fa9b30)と現ブランチで同一（5/5 とも Tab でメニューが閉じ dialog の『閉じる』へ進む）で回帰ではない。ADR-0043 の『Tab では開いたまま動かない』との食い違いは統括判断。

Tab 統一: 原因は useDialogModal の keydown（Tab 循環の補完）。dialog 内へポータルされたメニュー content が末尾の tabbable になり、先頭へ focus() していた。target がメニュー content の中なら何もしない形に直した（ADR-0043 の『メニューは開いたまま動かない』のまま、ADR 変更なし）。ダイアログの中（行の︙・▾）と外（ソート・サイドバー＋）で5回ずつ測り、すべて開いたまま・focusin/out なし・body 経由なし。unit（useDialogModal）と smoke（unregisteredDlsite）で縛った。

Tab 補足: メニュー内の判定は layerDom.isInsideMenuContent。ダイアログ内のポップオーバーの Tab は触っていない（dialog の循環に任せる。ポップオーバーは非モーダルの層で、外へ出ればフォーカス移動で閉じるのが正しく、末尾での循環の補完を残すと body に落ちる欠陥が戻るため）。実測: 作品編集ダイアログのタグ追加ポップオーバーで Tab を6回押すと、ポップオーバーは閉じ、ダイアログ内を順に進み body を経由しない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
呼び出し側の命令的な補修をなくした: ▾は useMotionMenu の interceptOpen（制御モードは restoreFocus を失うので不採用）、パンくずは Breadcrumbs.lastSegmentId、TagAddPopover とトリガー1つ、ScanSidebar は入れ物がフォーカスを持って入れ替わりで引き継ぐ、softDisabled を Button と IconButton で共有。ダイアログ内のメニューの Tab が useDialogModal の循環で閉じていたのを直し、ADR どおり開いたままに揃えた。smoke のフレークは値一覧本体と同名のロケータが原因でテストを絞った（30/30）。ADR-0043・design-system 更新。check・test・smoke（76）成功、Opus レビュー3回で合格。
<!-- SECTION:FINAL_SUMMARY:END -->
