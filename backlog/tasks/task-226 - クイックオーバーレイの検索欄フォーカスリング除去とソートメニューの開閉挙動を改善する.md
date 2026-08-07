---
id: TASK-226
title: クイックオーバーレイの検索欄フォーカスリング除去とソートメニューの開閉挙動を改善する
status: To Do
assignee: []
created_date: '2026-08-07 08:18'
updated_date: '2026-08-07 08:28'
labels: []
dependencies: []
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ検索のクイックオーバーレイ（AxisValueQuickList）で、(1) 検索入力のフォーカスリング（shell.css:1592-1596 の outline: 2px solid var(--acc)）が目立ちすぎるため、キャレット表示のみにする。(2) ソートトグルで開く並び替え選択列が、ソートキー選択と同時に閉じてしまい使いにくいため、選択後も開いたままにする。閉じるのはトグル再クリックまたはポップアップ自体が閉じるとき。メニューが開いたままになるのに合わせ、アクティブキーの再クリックで昇順/降順を反転させ（値一覧の列見出しの toggleAxisValueSort と同じ挙動）、アクティブなキーと方向が視覚的にわかるようにする。実装箇所: client/src/features/library/ui/AxisValueQuickList.tsx:189-225、client/src/features/library/model/axisValueSort.ts、client/src/styles/shell.css。デザインは docs/design-system.md に従う
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 クイックオーバーレイの検索入力はフォーカス時にアウトラインを表示せず、キャレット表示のみになる
- [x] #2 並び替え選択列はソートキーをクリックしても閉じず表示され続ける
- [x] #3 並び替え選択列はトグルボタンの再クリック、またはポップアップ自体が閉じるときに閉じる
- [x] #4 アクティブなソートキーと方向（昇順/降順）が選択列上で視覚的に判別できる
- [x] #5 アクティブなキーを再クリックすると昇順/降順が反転する（toggleAxisValueSort と同じ挙動）
- [x] #6 pnpm check と変更範囲のテストが通る
- [x] #7 クイックオーバーレイの値行は文字数によらず全幅で、件数は右端揃えになる（仮想化行のwidth欠落を修正）
<!-- AC:END -->
