---
id: TASK-234
title: AND追加を冪等なaddLibraryTagAtomにし、値選択の方針を単一の契約へ集約する
status: To Do
assignee: []
created_date: '2026-08-07 13:20'
updated_date: '2026-08-07 13:37'
labels: []
dependencies: []
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビューで見つかった2件をまとめて解消する。

(1) 「〇〇をAND追加」ボタンが toggleLibraryTagAtom に直結しており（AxisColumn.tsx:203 の onAddValue={onToggleTag}、FilterChipBand.tsx:76 の onAdd={onToggle}、値一覧側は AxisValueList.tsx:78 の handleAdd）、選択済みの行で押すとタグが解除される。ラベルとADR-0013の「追加専用操作」という定義に反する。冪等な addLibraryTagAtom を新設し、追加ボタンはこれを呼ぶ。既に選択済みなら何もしない。組み込み擬似タグ軸（year等）の同軸排他、履歴コミット、selectedWorkIdクリアは toggleLibraryTagAtom と同じ扱いを引き継ぐ。結果面は現在地に留まる（ADR-0012 §8）。加えて、選択済みの行には追加ボタン自体を表示しない。toggleLibraryTagAtom は解除とCtrl/Cmd+クリックによる反転の経路として残す。

(2) 入口ごとの既定動作（置き換え/AND追加）と追加ボタンの有無が、onAdd を渡すか渡さないかという暗黙の規約で表現されており、「AND追加が既定なのに追加ボタンあり」のような不正な組み合わせも型を通る。判断も AxisColumn・FilterChipBand・FilterChipAddButton に分散しており、docs/design-system.md:79 の「この判断はどの入口でも2つのaction atomに集約し、コンポーネント側で個別分岐を作らない」という規約と合っていない。各入口が既定の意図（replace | add）だけを宣言し、そこから主クリックの意味・Ctrl反転先・追加ボタンの有無を導出する単一の契約へ集約する。導出ロジックは1箇所に置き、AxisValueQuickList と AxisValueRows / AxisValueGrid の両方が同じ契約を使う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 追加ボタンは冪等な addLibraryTagAtom を呼び、選択済みタグを解除しない
- [x] #2 選択済みの行には追加ボタンが表示されない（値一覧・クイックオーバーレイの両方）
- [x] #3 addLibraryTagAtom が組み込み擬似タグ軸の同軸排他・履歴コミット・selectedWorkIdクリアを toggleLibraryTagAtom と同様に扱う
- [x] #4 各入口は既定の意図（replace | add）だけを宣言し、主クリックの意味・Ctrl反転先・追加ボタンの有無がそこから導出される
- [x] #5 不正な組み合わせ（AND追加既定なのに追加ボタンあり等）が型で表現できなくなっている
- [x] #6 docs/design-system.md の値選択の規約が新しい契約の記述に更新されている
- [x] #7 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
