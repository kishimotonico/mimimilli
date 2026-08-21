---
id: TASK-375
title: 本文フォントスタックの先頭をNoto Sans JPにする
status: Done
assignee: []
created_date: '2026-08-21 13:24'
updated_date: '2026-08-21 13:28'
labels: []
dependencies: []
modified_files:
  - client/src/styles/tokens.css
  - docs/design-system.md
ordinal: 375000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows 11 24H2以降でNoto Sans JP（7ウェイト）が標準搭載されたため、本文フォント（--font-jp）の先頭をNoto Sans JPにする。游ゴシックの字形が微妙という課題への対応。24H2以降を前提とし、旧Windows向けのYu Gothic UI/Meiryoフォールバックは撤去する。

設計:
- client/src/styles/tokens.css の --font-jp を "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", system-ui, sans-serif へ変更（Mac=Hiragino、Linux開発環境=Noto Sans CJK JPは維持）
- docs/design-system.md のタイポグラフィ節を同じ値に更新し、Windows 11 24H2+前提であることを記載
- 注意: Windows標準版Noto Sans JPにはweight 600/800が無く、600は700へスナップする（対応不要、記録のみ）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 --font-jp の先頭が Noto Sans JP になり、Yu Gothic UI・Meiryo がスタックから消えている
- [x] #2 docs/design-system.md が新スタックとWindows 11 24H2+前提を記載している
- [x] #3 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#1: client/src/styles/tokens.css の --font-jp を "Noto Sans JP" 先頭に変更。Yu Gothic UI・Meiryo を削除済み。

AC#2: docs/design-system.md タイポグラフィ節を新スタックに更新し、Windows 11 24H2以降前提を記載。

AC#3: pnpm check 成功、pnpm test:smoke 23件すべて成功（Playwright chromium インストール後）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Windows 11 24H2+のNoto Sans JP標準搭載を前提に、--font-jpの先頭をNoto Sans JPへ変更しYu Gothic UI/Meiryoを撤去。design-system.mdも更新。smoke 23/23。Windows標準版はweight 600/800が無く600は700へスナップ（対応不要と判断）。
<!-- SECTION:FINAL_SUMMARY:END -->
