---
id: TASK-438
title: 狭幅でライブラリの一覧最低幅を保ちプレビューを全幅オーバーレイへ切り替える
status: To Do
assignee: []
created_date: '2026-09-07 20:52'
updated_date: '2026-09-07 20:52'
labels:
  - ui
  - layout
  - responsive
dependencies: []
ordinal: 459000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
responsive-keyboard-A / work-detail-A、および TASK-430 から分離した受け入れ条件。ライブラリ2ペイン構成の狭幅時の設計要件であり、プレイヤーpopupの重なり解消（TASK-430）とは独立した関心事。

現状の問題: 幅1100px未満でプレビューが一覧を潰す。プレビューが固定420pxで、要件v4 §7.3 の「可変幅・最小360px」と一致していない。一覧は130pxまで潰れ、list行が読めなくなる。現状のコードに切り替えのブレークポイント機構は存在せず、`.mll-results__preview` の `max-width: 90%` による副次的な全幅化があるだけ。

仕様:
- 一覧に最低幅（list行が読める幅）を持たせる
- 一覧最低幅とプレビュー最小360pxの両方を確保できない幅では、プレビューを結果面上の全幅オーバーレイへ切り替える。Esc と × で閉じられること
- オーバーレイの出入りは既存の PreviewPaneSlide の AnimatePresence 境界を流用する（ADR-0014 の原則に従い、ラッパーDOMを新設しない）
- 切り替えの閾値は固定pxで書かず、一覧最低幅とプレビュー最小幅の和から導出する。両方の最小幅は tokens.css にトークンとして置く

根拠: 要件v4 §7.3。関連: TASK-430（AC#2後半をこのタスクへ分離）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 一覧が最低幅を下回らず、狭幅でもlist行が読める
- [ ] #2 一覧最低幅とプレビュー最小360pxを確保できない幅で、プレビューが結果面上の全幅オーバーレイへ切り替わる
- [ ] #3 全幅オーバーレイをEscと×で閉じられる
- [ ] #4 切り替え閾値が固定pxではなく、tokens.cssに置いた一覧最低幅とプレビュー最小幅から導出されている
- [ ] #5 800・1000・1280pxで切り替えが仕様どおりに動く
- [ ] #6 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
