---
id: TASK-335
title: fixture開発をBunサーバーへ移しViteのAPI経路をproxyへ一本化する
status: To Do
assignee: []
created_date: '2026-08-14 10:26'
labels: []
dependencies: []
priority: high
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018の実装本体。fixture開発のAPIをViteプロセス内のNode middleware（client/vite.config.tsのfixtureApiPlugin）から、real・配布と同じBun.serve経路へ移す。

土台は実装済み: server/src/index.tsはMIMIMILLI_ADAPTER=fixtureでfixture adapterをBun.serve起動でき、MIMIMILLI_MOCK_SCENARIOでシナリオ切替できる。real開発用のMIMIMILLI_BACKEND_SERVICE + portless proxy（vite.config.tsのresolveBackendProxy）をfixtureにも流用する。

注意: fixtureのin-memory状態はbun --watch再起動でリセットされるが、現行のlistener再生成と同じ挙動なので許容。Playwright smokeのwebServer再設計は別タスク（このタスクの完了までsmokeが壊れる場合は同一統合ブランチ内で続けて対応する）。

参照: docs/adr/0018-vite-client-bun-server-separation.md、client/vite.config.ts、server/src/index.ts、client/package.json（dev:*スクリプト群）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server側にfixture起動スクリプトがあり、MIMIMILLI_ADAPTER=fixture + シナリオ環境変数でbun --watch起動し、portlessへサービス登録される
- [ ] #2 ルートpnpm devとシナリオ別スクリプト（dev:new-work等）がViteとBun fixtureサーバーを並列起動し、一コマンドで従来どおり開発できる
- [ ] #3 client/vite.config.tsからfixtureApiPlugin・server/shared watcher・module graph無効化が消え、/api proxyがfixture/real共通の一本になる
- [ ] #4 client/package.jsonから@hono/node-serverと@mimimilli/serverの依存が消える
- [ ] #5 server/shared配下のコード変更がbun --watchの再起動でfixture APIへ反映される
- [ ] #6 worktreeでdev:new-workを起動するとBunサーバーもブランチ名サブドメインで分離される
<!-- AC:END -->
