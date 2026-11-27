---
id: TASK-533
title: 検索の保存ダイアログの select 3つを Ark のセレクトに置き換える
status: To Do
assignee: []
created_date: '2026-11-27 13:58'
labels:
  - ui
dependencies:
  - TASK-531
priority: low
ordinal: 657000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ネイティブの `<select>` はドロップダウンが OS 描画で、メニュー・ポップオーバーと見た目・出入り・キー操作が揃わない。ADR-0043 の「セレクトの入れ子の Esc は確かめていない」を、ここで確かめる。
範囲: `SmartFolderDialog` の「グループ分け」「{グループ名}のソート」「既定のソート／作品のソート」の3つ。ほかに `<select>` は無い。
対象外: ツールチップ、他の部品。

実装方針（既定で決める。見た目に異論があれば着手前に相談する）:
- トリガーは現行の `.mll-fld select` の枠・高さに合わせる。パネルはメニューと同じ外枠と出入り（`layerScale`）。選択中の項目にはチェックを付け、開いたとき現在値をハイライトする。OS のドロップダウンを失うことは受け入れる
- 値が空の選択肢（「なし」「「すべて」と同じ」）は、Ark の Select が空文字の値を扱えるかを最初に確かめる。扱えなければ、保存する値との変換を1か所に置く
- ダイアログを開いた直後の初期フォーカス（現状 `sortRef`）は変えない
- Ark の Select には `finalFocusEl` が無く、閉じるとトリガーへ戻る。ダイアログの中のセレクトでは、これで足りるか確かめる

共通の前提:
共通の前提（各タスクの説明に書く）:
- 段階4のマージ後の master から切る。ダイアログは Ark の Dialog になっていて、ネイティブ dialog 向けの例外（`layerContainer` の dialog 分岐など）は無い
- 各所で Ark の部品を直接組む。汎用ラッパーは作らない（ADR-0043）。共通にするのは見た目のクラス・既定値に限る
- 置き換えたものから旧実装を削除する。互換レイヤーは入れない
- 実装中は変更範囲のテスト。`pnpm check && pnpm test` はタスク完了時に1回。UI を変えるので `pnpm test:smoke` を AC に含める
- ADR-0043 の書き換え（adr-0043-changes.md）は TASK-529 のマージ後に済んでいる前提
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `SmartFolderDialog` の3つの `<select>` が Ark のセレクトになり、ネイティブの `<select>` が残らない。ラベルとの関連・`disabled`・値が空の選択肢・保存される値が従来と同じ
- [ ] #2 Esc が一段ずつ閉じる。セレクトを開いたまま Esc → セレクトだけ閉じ、フォーカスはトリガーに戻り BODY を経由しない。次の Esc でダイアログが閉じる。「入力中の編集 → セレクト → ダイアログ」の入れ子を含め各10回
- [ ] #3 セレクトを開いたまま backdrop を押したときの挙動が、段階4で決めた全層共通の規則に従う
- [ ] #4 キーボード（矢印・Enter・Esc・Home／End）で操作でき、開いたとき現在値がハイライトされる。パネルがダイアログの境界に切られず、出入りの動き・位置・幅がメニューと揃っている
- [ ] #5 `SmartFolderDialogHost.test` の `getByLabelText`／`toHaveValue`／`toBeDisabled` と `sidebarEdit.smoke.spec` の `selectOption`／`option[value='']` が新しい操作に置き換わっている
- [ ] #6 ADR-0043 の「セレクトの入れ子の Esc は確かめていない」の記述が確認結果に書き換わり、`docs/design-system.md` にセレクトの規定がある。`pnpm check && pnpm test` と `pnpm test:smoke` が通る
<!-- AC:END -->
