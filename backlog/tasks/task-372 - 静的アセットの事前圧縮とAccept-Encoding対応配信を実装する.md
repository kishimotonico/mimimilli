---
id: TASK-372
title: 静的アセットの事前圧縮とAccept-Encoding対応配信を実装する
status: To Do
assignee: []
created_date: '2026-08-21 12:49'
updated_date: '2026-08-21 12:55'
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
- [x] #1 vite build で dist の js/css 等に .br/.gz が生成される
- [x] #2 Accept-Encoding: br のリクエストに Content-Encoding: br・Vary: Accept-Encoding・正しいContent-Typeで配信され、gzipのみ・無指定でも適切にフォールバックする（テストで検証）
- [x] #3 preview 環境の curl 実測で主要JS/CSSの転送サイズが素の1/3以下になっている
- [x] #4 圧縮ファイルが無いアセットは従来通り配信され、既存の staticServe テストが全て通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
根拠: pnpm --filter @mimimilli/client build 後、client/dist/assets/index-C5rrk2zx.js に .br(210421B)・.gz(248744B)、index-BO9NTAad.css に .br(39897B)・.gz(120097B)、index.html に .br/.gz が生成。woff2(ibm-plex-sans-jp等)には .br/.gz なし。vite-plugin-compression2 を採用（gzip+brotliCompress同時生成、include/excludeでテキスト系のみ対象、Vite7対応・メンテ活発）。

根拠: server/tests/staticServe.test.ts に5件追加（br選択・gzipフォールバック・未指定時素配信・圧縮無しアセット・SPAフォールバックbr）。全17件 pass。負の検証: staticServe.ts の br 分岐を if(false&&...) で無効化→「Accept-Encoding: br」テストが content-encoding null !== 'br' で失敗、復元後 pass。

根拠: portless run --force --app-port 6421（6420占有のため）で http://372-precompressed-assets.mimi.localhost:1355 起動。curl実測: JS 803184B→br 210421B(26%)、CSS 417507B→br 39897B(9.6%)、いずれも素の1/3以下。Content-Encoding: br/gzip、Vary: Accept-Encoding、Content-Type(text/javascript,text/css)を確認。検証後プロセス終了済み。

根拠: 圧縮ファイル無しの createStaticFixture では Accept-Encoding: br,gzip でも素配信(content-encoding null)。既存12件+新規5件の staticServe テスト計17件、server全体688件 pass。キャッシュヘッダ(/assets immutable・index no-cache)・シンボリックリンクガードテストも維持。
<!-- SECTION:NOTES:END -->
