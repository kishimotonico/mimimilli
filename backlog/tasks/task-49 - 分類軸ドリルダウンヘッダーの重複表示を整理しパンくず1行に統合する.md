---
id: TASK-49
title: 分類軸ドリルダウンヘッダーの重複表示を整理しパンくず1行に統合する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-18 20:22'
updated_date: '2026-07-18 20:26'
labels: []
dependencies: []
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CV・サークル等の分類軸ドリルダウン画面のヘッダー（client/src/features/library/ui/DrillHeader.tsx）で、1行目のパンくず（戻る矢印+軸ラベル+値+件数バッジ、DrillHeader.tsx:19-30）と2行目のサブ見出し（「この○○の作品」+同じ件数、DrillHeader.tsx:31-34）が役割・情報とも重複している。件数は26行目と33行目の2箇所で同じ値を描画。

対応方針（ユーザー確定済み）: サブ見出し行（.mle-drill__sub）を削除し、パンくず1行に統合する。パンくずに軸ラベル・値・件数がすべて揃っているため情報の欠落はない。必要に応じて値（.mle-drill__val）の強調を調整してよい。

DrillHeaderは isFacetAxis の全軸（CV・サークル・シリーズ・カテゴリ・タグprefix軸）共通のコンポーネントで、ContentColumn.tsx:172 と WorkGrid.tsx:330 から呼ばれる。CSSは client/src/styles/shell.css:1119以降（.mle-drill〜.mle-drill__sub）。未使用になったCSSクラスは削除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 分類軸ドリルダウン画面のヘッダーが1行（戻る導線+軸ラベル+値+件数）になり、「この○○の作品」の行が表示されない
- [x] #2 件数の表示が1箇所のみになる
- [ ] #3 リスト表示（ContentColumn）とグリッド表示（WorkGrid）の両方で崩れなく表示される
- [x] #4 未使用になったCSSクラスが削除されている
- [x] #5 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex(thread 019f76e6-9582)が実装。DrillHeader.tsxのサブ見出し行と shell.css の .mle-drill__sub / .count を削除。pnpm check・test(202件)通過。AC3(両表示の実機確認)はブラウザ検証で確認予定。
<!-- SECTION:NOTES:END -->
