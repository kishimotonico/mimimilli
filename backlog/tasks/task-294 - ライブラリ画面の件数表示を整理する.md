---
id: TASK-294
title: ライブラリ画面の件数表示を整理する
status: To Do
assignee: []
created_date: '2026-08-10 18:59'
labels: []
dependencies: []
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
件数表示が分散・重複している。(1) 一覧の「作品 N件」バー（client/src/features/library/ui/WorkGrid.tsx:160-163、リスト表示はWorkListPane.tsx:110）は件数以外の情報・機能を持たないため削除し、件数はその上のタグフィルター行（FilterChipBand、LibraryView.tsx:223-230）へ移して縦の要素を節約する。(2) 軸レールヘッダーの「ライブラリ N件」（client/src/features/library/ui/AxisColumn.tsx:161-166）は見出し「ライブラリ」と表示が重複し総件数しか出していないため削除する。フィルター無しの状態なら一覧側の件数が全件数を兼ねる。両者は .mle-col__hd クラスを共有しているためスタイル変更の影響範囲に注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 「作品 N件」バーが削除され、件数がタグフィルター行に表示される
- [ ] #2 リスト表示でも同様に件数表示が整理される
- [ ] #3 軸レールヘッダーから総件数表示が消える
- [ ] #4 pnpm test:smoke が通る
<!-- AC:END -->
