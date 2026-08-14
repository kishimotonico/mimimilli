---
id: TASK-335
title: fixture開発をBunサーバーへ移しViteのAPI経路をproxyへ一本化する
status: To Do
assignee: []
created_date: '2026-08-14 10:26'
updated_date: '2026-08-14 13:18'
labels: []
dependencies: []
priority: high
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018の実装本体。fixture開発のAPIをViteプロセス内のNode middleware（client/vite.config.tsのfixtureApiPlugin）から、real・配布と同じBun.serve経路へ移す。

土台は実装済み: server/src/index.tsはMIMIMILLI_ADAPTER=fixtureでfixture adapterをBun.serve起動でき、MIMIMILLI_MOCK_SCENARIOでシナリオ切替できる。real開発用のMIMIMILLI_BACKEND_SERVICE + portless proxy（vite.config.tsのresolveBackendProxy）をfixtureにも流用する。

注意:
- fixtureのin-memory状態はbun --watch再起動でリセットされるが、現行のlistener再生成と同じ挙動なので許容
- bun --watch再起動時はSSE接続も切れる。クライアント側の再接続で吸収されること（スキャン・DLsite進捗UIが再起動後も追従すること）を確認する
- 現行fixture APIはclientのportless登録（mimi）に相乗りしており独立ポートを持たない。分離後はBunサーバー側のportlessサービス登録（real開発のapi.mimiと同様）が新たに必要
- Playwright smokeのwebServer再設計は別タスク（TASK-336）。このタスクの完了までsmokeが壊れる場合は同一統合ブランチ内で続けて対応する

参照: docs/adr/0018-vite-client-bun-server-separation.md、client/vite.config.ts、server/src/index.ts、client/package.json（dev:*スクリプト群）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 server側にfixture起動スクリプトがあり、MIMIMILLI_ADAPTER=fixture + シナリオ環境変数でbun --watch起動し、portlessへサービス登録される
- [x] #2 ルートpnpm devとシナリオ別スクリプト（dev:new-work等）がViteとBun fixtureサーバーを並列起動し、一コマンドで従来どおり開発できる
- [x] #3 client/vite.config.tsからfixtureApiPlugin・server/shared watcher・module graph無効化が消え、/api proxyがfixture/real共通の一本になる
- [x] #4 client/package.jsonから@hono/node-serverと@mimimilli/serverの依存が消える
- [x] #5 server/shared配下のコード変更がbun --watchの再起動でfixture APIへ反映される
- [x] #6 worktreeでdev:new-workを起動するとBunサーバーもブランチ名サブドメインで分離される
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-339でserver/tests/fixtureMediaNodeServer.test.tsとserver/package.jsonのdevDependency @hono/node-server を追加した（fixture開発経路でメディアルートが壊れないことの回帰テスト）。本タスクでfixture経路をBun.serveへ移したら、このテストとserver側のdevDependencyも削除する。
<!-- SECTION:NOTES:END -->
