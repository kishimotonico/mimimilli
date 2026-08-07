---
id: TASK-230
title: タグ値の通常クリックを完全置換にする
status: To Do
assignee: []
created_date: '2026-08-07 12:22'
labels: []
dependencies: []
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0013の決定に基づき、タグ値の通常クリックを prefix や軸に関係なく常に完全置換にする。現状は computeReplacedTags（client/src/features/library/model/libraryPresentation.ts:90-93）が同一 tagFilterGroupKey のタグだけを外して追加するグループ内置換のため、同じクリックが対象タグの prefix によって置き換えにも AND 追加にもなり、ユーザーが結果を予測できない。tagFilterGroupKey（同72-77）と computeReplacedTags は他に利用箇所がなく（axisOfFilterTag は別物でFilterChipBandが使用中・存置）、削除して replaceLibraryTagAtom（libraryNavigationActions.ts:55-63）で選択配列を [tag] に差し替えるだけにする。selectSoleLibraryTagAtom とは軸遷移の規則が異なるため統合しない。AND追加経路（toggleLibraryTagAtom）の year 等の組み込み軸の単一選択扱いは維持する（異なる2年のANDは恒常0件のため）。既存テストは libraryPresentation.test.ts:65-73 と libraryNavigationActions.test.ts:167-175 の期待値更新が必要
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 選択中のタグがある状態で別 prefix のタグを通常クリックすると、既存の選択が全て外れて選んだタグ1つだけになる
- [ ] #2 同一 prefix のタグを通常クリックした場合も同様に1つだけになる
- [ ] #3 Ctrl/Cmd+クリックでの AND 追加は従来どおり動作する
- [ ] #4 tagFilterGroupKey と computeReplacedTags が削除され、参照が残っていない
- [ ] #5 year 等の組み込み軸の AND 追加時の単一選択扱いが維持されている
- [ ] #6 置き換え時の結果面遷移（ADR-0012 §8）が従来どおり動作する
- [ ] #7 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
