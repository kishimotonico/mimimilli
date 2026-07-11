---
id: DRAFT-19
title: モバイルシェルレイアウトの実装
status: To Do
assignee: []
created_date: '2026-07-10 12:34'
updated_date: '2026-07-11 10:53'
labels: []
dependencies:
  - TASK-30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
狭幅時にAppShellのデスクトップ3ペイン構成をモバイル向けレイアウトに切り替える。方針はADR-0005（docs/adr/0005-mobile-ui-strategy.md）に従う。

決定事項:
- ブレークポイントは768pxの単一分岐。tokens.cssにトークン定義し、共有useMediaQueryフック経由で参照
- 狭幅時はAppShellの代わりにMobileShellを新設してApp.tsxで出し分け（CSSで畳む方式は採らない）
- ナビはボトムタブ（ライブラリ / スマートフォルダー / お気に入り の3タブ想定）。LeftNav・AddressBarはモバイルでは使わない

スコープはシェルとナビゲーションのみで、各画面の中身は別ドラフト。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ブレークポイントがトークンとして定義され、共有フック/ユーティリティ経由で参照される
- [ ] #2 デスクトップ表示に回帰がない（ビジュアルテスト通過）
- [ ] #3 768px以下でMobileShell（1カラム＋ボトムタブ）に切り替わる
<!-- AC:END -->
