---
id: TASK-231
title: タグ選択ポップオーバーの値行にAND追加ボタンを置く
status: To Do
assignee: []
created_date: '2026-08-07 12:22'
labels: []
dependencies: []
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0013の決定に基づき、置き換えが既定の値選択入口すべてに可視のAND追加ボタンを置く。現状は結果面の値一覧（AxisValueRows.tsx:186-192 / AxisValueGrid.tsx:178-184）にしかホバー表示の＋ボタンがなく、軸レールのクイックオーバーレイとチップの兄弟値ドロップダウン（どちらも AxisValueQuickList.tsx を共有）ではAND追加の手段がCtrl+クリックのみで画面上に手がかりがない。AxisValueQuickList の値行は現在 行全体が1つの button（.mll-qlist__item, role=option）だが、button の入れ子を避けるため値一覧と同じ「div role=option の中に主選択ボタンと追加ボタンを並べる」構造へ変更する。CSSは .mll-vrow__add（shell.css:1430-1441）の絶対配置パターンを流用し、仮想化の固定行高（ROW_ESTIMATE_SIZE=29）は変えない。見出し行には付けない。キーボードフォーカス制御は data-quicklist-item 属性を主選択ボタン側に残す。onAdd を props に追加し呼び出し元3箇所（AxisQuickOverlay / AxisValuePopoverPanel / FilterChipAddButton）へ配線するが、既定がAND追加である「＋絞り込み」入口（FilterChipAddButton）には追加ボタンを出さない（同じ操作の二重提供を避けるため。既存のhint「AND追加されます」は維持）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 軸レールのクイックオーバーレイの値行にホバー・フォーカスするとAND追加ボタンが現れ、押すと選択が置き換わらずAND追加される
- [ ] #2 チップの兄弟値ドロップダウンでも同様にAND追加ボタンが機能する
- [ ] #3 「＋絞り込み」から開く値リストにはAND追加ボタンが出ず、既存のhint表示が維持されている
- [ ] #4 追加ボタンのアクセシブル名が「〇〇をAND追加」で値一覧と統一されている
- [ ] #5 見出し行には追加ボタンが出ない
- [ ] #6 仮想化の行高とキーボード操作（矢印キーでの移動・フォーカス）に退行がない
- [ ] #7 pnpm check と変更範囲のテストが通る
<!-- AC:END -->
