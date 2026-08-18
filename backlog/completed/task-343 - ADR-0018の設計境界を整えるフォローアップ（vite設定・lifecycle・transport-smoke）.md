---
id: TASK-343
title: ADR-0018の設計境界を整えるフォローアップ（vite設定・lifecycle・transport smoke）
status: Done
assignee: []
created_date: '2026-08-14 16:42'
updated_date: '2026-08-14 16:54'
labels: []
dependencies: []
priority: medium
ordinal: 353000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018のマージ後（34e5ac3..4bc1321）に実施した敵対的レビューで挙がった設計境界の指摘3件に対応する。いずれも動作不良ではなく境界の置き方の問題。

1. client/vite.config.tsのresolveApiProxy()がconfig評価時に無条件実行されるため、proxyを使わないvite buildやVitest実行までportless getの子プロセスに依存する
2. server/src/serverLifecycle.tsのisRealAdapter型ガードにより、lifecycle層が具体アダプタ（RealAdapter）を知っている（旧index.tsからの持ち込み）
3. server/tests/transport/helpers.tsがBun.serve設定を独自に再構築しているため、index.ts側の配線を壊してもtransport smokeが緑のままになる

参照: docs/adr/0018-vite-client-bun-server-separation.md、client/vite.config.ts、server/src/serverLifecycle.ts、server/src/index.ts、server/tests/transport/helpers.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 vite buildとVitestがportlessの解決なしで実行でき、proxy構成はcommand===serveのときだけ行われる
- [x] #2 serverLifecycleがRealAdapterをimportせず、DataAdapterのオプショナルなcloseを呼ぶだけになっている
- [x] #3 Bun.serveの組み立てが副作用のないfactoryへ切り出され、index.tsとtransport helperの双方がそれを使う
- [x] #4 配線を壊すとtransport smokeが赤くなることを負の検証で確認した
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
transport smokeが検知できる配線の範囲（負の検証で確認した限界）。

検知できる: Bun.serveのfetch配線。app.fetch以外に差し替えると transport テスト7件が失敗する（range 2件・trailingSlash 2件・sse 2件・shutdown 1件）。

検知できない:
- idleTimeout（90→5に変更しても9 pass のまま）。テストの実行時間がidle timeoutに達しないため
- hostname（127.0.0.1→0.0.0.0に変更しても9 pass のまま）。テストが127.0.0.1へ接続するため0.0.0.0でも通る

この2つは対応なしとする。idleTimeoutの回帰はADR-0019のserver/tests/real/mediaIdleTimeout.test.tsが実質カバーしており、transport smokeに90秒待つテストを足すのはAGENTS.mdの「テストは網羅性より実行速度」に反する。hostnameは0.0.0.0でも127.0.0.1接続が通るため、検知できても実害の予測に結びつかない。

レビュー指摘で追加対応した2点:
- client/vite.config.tsの条件付きスプレッドを三項演算子へ（挙動差なしを実測確認済み。Viteはオプショナルフィールドの解決に??ベースの正規化を使うため、キー欠落とundefinedは等価）
- server/src/serve.tsのportを必須引数にし、既定値8080を削除（index.tsのNumber(process.env.PORT ?? 8080)と二重化していた。環境解決はindex.tsが持つという分離意図に合わせる）
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
client/vite.config.tsをdefineConfigの関数形式にし、command===serveのときだけserver.proxyを構成する（vite build・Vitestがportlessに依存しなくなった）。DataAdapterにオプショナルなclose?を追加してserverLifecycleからRealAdapterのimportとisRealAdapter型ガードを削除。server/src/serve.tsを新設してcreateApp+Bun.serveの組み立てをserveMimimilliへ切り出し、index.tsとtransport helperの双方が使う形にした（index.tsには環境解決・シグナル登録・process終了だけが残る）。検証: pnpm check && pnpm test 成功（server 617 / client 811）、ダミーportlessをPATH先頭に置いた状態でclient buildとVitestが通ること、fetch配線を壊すとtransport smokeが7件失敗することを負の検証で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
