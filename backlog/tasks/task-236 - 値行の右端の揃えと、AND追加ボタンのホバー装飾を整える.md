---
id: TASK-236
title: 値行の右端の揃えと、AND追加ボタンのホバー装飾を整える
status: Done
assignee: []
created_date: '2026-08-07 15:10'
updated_date: '2026-08-07 15:38'
labels: []
dependencies: []
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ検索の値選択UIの見た目を2点整える。

(1) 右端のガタつき: AxisValueQuickList.tsx:299 が `paddingRight: onAdd && !on ? 26 : 8` と条件分岐しているため、AND追加ボタンが出る行と出ない行（選択済み行）で件数の位置が18pxずれ、リスト全体がガタガタに見える。値一覧側（AxisValueRows は .mll-vrow__main に padding-right:30px 固定、AxisValueGrid はタイル）は既にボタンを position:absolute で重ねる方式で揃っているため、クイックリストもこれに合わせる。三項演算子をやめて paddingRight を固定にする（.mll-qlist__add は shell.css:1694 で既に position:absolute; right:4px）。

(2) AND追加ボタンの当たり判定が見えない: .mll-qlist__add / .mll-vrow__add / .mll-vtile__add は位置と opacity のみを指定し、見た目は IconButton の既定（hover:bg-paper-2）に委ねている。しかし親の行自体が hover で background: var(--paper-2) になる（shell.css:1410 / 1485 / 1688）ため、行の背景とボタンのホバー背景が同色になり視覚的な差が出ない。この3クラスに hover 時 background: var(--paper-3) を与えて一段濃くする（--paper-3 は pressed/縞の位置づけで、Tag.tsx:23 の bg-paper-2 → hover:bg-paper-3 と同じ語彙）。transition は shell.css:2114 等の既存慣用値 background-color 0.12s ease に合わせる。IconButton の既定スタイルは全アプリ横断で使われているため変更せず、className 経由で上書きする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 クイックリストの値行で、AND追加ボタンの有無にかかわらず件数の右端位置が揃う
- [x] #2 AND追加ボタンにホバーすると行の背景より一段濃い背景が付き、ボタンの範囲が視認できる（クイックリスト・値一覧の行・タイルの3箇所）
- [x] #3 ホバー背景の変化に短いトランジションが付いている（既存の 0.12s ease に合わせる）
- [x] #4 IconButton の既定スタイルが変更されていない
- [x] #5 pnpm check と変更範囲のテスト、pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
値行の右余白を行の選択状態ではなくリスト単位（onAddの有無）で決める形に改め、件数の右端のガタつきを解消。AND追加ボタンは行のホバー背景と同じ--paper-2だったため範囲が見えなかったので、IconButtonにホバー/アクティブ背景を出さないbare variantをopt-inで追加し、CSS側で--paper-3を指定。当初!importantで上書きしていたが競合の根本を絶つ設計へ作り直した。transitionはIconButtonのtransition-colorsに委ねる。pnpm check・unit・smoke全通過、Codexレビュー指摘なしまで到達
<!-- SECTION:FINAL_SUMMARY:END -->
