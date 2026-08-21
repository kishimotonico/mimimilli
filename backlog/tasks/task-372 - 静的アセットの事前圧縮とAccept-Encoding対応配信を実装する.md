---
id: TASK-372
title: 静的アセットの事前圧縮とAccept-Encoding対応配信を実装する
status: To Do
assignee: []
created_date: '2026-08-21 12:49'
labels: []
dependencies: []
ordinal: 372000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リモート（SSHポートフォワード・HTTP/1.1）環境で本番ビルドの初回ロードが遅い対策の1つ。現状のBun静的配信（server/src/staticServe.ts、TASK-370）は無圧縮でJS 803KB・CSS 417KBをそのまま返している。事前圧縮で転送量を約1/4にする。

設計:
- client のビルドで dist のテキスト系アセット（js/css/html/svg/json）の .br と .gz を事前生成する（Viteプラグイン導入可。woff2等の圧縮済みバイナリは対象外）
- staticServe が Accept-Encoding を見て .br → .gz → 素 の順で選択し、Content-Encoding と Vary: Accept-Encoding、元ファイルのContent-Typeを付けて配信する
- オンザフライ圧縮は実装しない（事前圧縮のみ）
- 圧縮ファイルの有無はビルド次第なので、無ければ素のファイル配信（既存挙動）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 vite build で dist の js/css 等に .br/.gz が生成される
- [ ] #2 Accept-Encoding: br のリクエストに Content-Encoding: br・Vary: Accept-Encoding・正しいContent-Typeで配信され、gzipのみ・無指定でも適切にフォールバックする（テストで検証）
- [ ] #3 preview 環境の curl 実測で主要JS/CSSの転送サイズが素の1/3以下になっている
- [ ] #4 圧縮ファイルが無いアセットは従来通り配信され、既存の staticServe テストが全て通る
<!-- AC:END -->
