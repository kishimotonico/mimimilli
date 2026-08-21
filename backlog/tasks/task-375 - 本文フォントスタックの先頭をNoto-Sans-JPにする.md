---
id: TASK-375
title: 本文フォントスタックの先頭をNoto Sans JPにする
status: To Do
assignee: []
created_date: '2026-08-21 13:24'
labels: []
dependencies: []
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
- [ ] #1 --font-jp の先頭が Noto Sans JP になり、Yu Gothic UI・Meiryo がスタックから消えている
- [ ] #2 docs/design-system.md が新スタックとWindows 11 24H2+前提を記載している
- [ ] #3 pnpm test:smoke が通る
<!-- AC:END -->
