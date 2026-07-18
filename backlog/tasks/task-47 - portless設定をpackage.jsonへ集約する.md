---
id: TASK-47
title: portless設定をpackage.jsonへ集約する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-18 12:08'
updated_date: '2026-07-18 19:43'
labels: []
dependencies: []
modified_files:
  - package.json
  - pnpm-lock.yaml
  - client/package.json
  - client/vite.config.ts
  - server/package.json
  - README.md
  - docs/ARCHITECTURE.md
  - docs/HANDOFF.md
  - docs/adr/0002-mock-as-fixture-adapter.md
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client、Backlog browser、real APIを同じportlessプロキシで起動できるようにする。portlessを0.15.4へ更新し、各アプリ名はpackage.jsonへ置く。共有プロキシのHTTP・1355番指定は公式対応の環境変数で渡し、自動起動と既存プロキシ共有を保つ。real clientはportless getで同じworktreeのAPIを参照する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 portlessが0.15.4へ更新されている
- [x] #2 mimi.localhost:1355でクライアントを起動できる
- [x] #3 backlog.localhost:1355でBacklog browserを起動できる
- [x] #4 mimiとBacklog browserの起動時にportlessプロキシを明示起動しない
- [x] #5 realバックエンドがportlessサービスとして動的ポートで起動する
- [x] #6 クライアントがportless getで同じworktreeのバックエンドURLを解決する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. serverのdev:realをapi.mimi名のportlessサービスとして起動する
2. clientのdev:realでサービス名をVite設定へ渡し、portless get api.mimiで同じworktreeのURLを解決する
3. Vite proxyは127.0.0.1上のportlessへ接続し、HostヘッダーでAPIへルーティングする
4. dev:realでAPI疎通を確認し、ドキュメント更新、check、testを実行する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
portlessのpackage.json script設定ではViteへの動的ポート注入が効かないため、package.jsonのportlessキーは名前だけにし、portless run viteで直接起動する構成にした。pnpm checkとpnpm testが成功。mimi.localhost:1355とbacklog.localhost:1355はいずれもHTTP 200を確認した。

レビューを受け、portless:proxyの明示起動は共有プロキシの設計に合わないと判断した。プロキシが未起動なら自動起動し、起動済みなら共有できる環境変数方式へ戻す。

最終確認: 明示的なproxy startなしでmimiを起動後、Backlog browserも同じ1355番プロキシへ登録された。両URLともHTTP 200。pnpm checkとpnpm testも成功。

追加範囲: 固定localhost:8080を廃止し、realバックエンドもportlessへ統合する。複数worktreeではportless getにより対応するバックエンドを参照する。

Fableレビューを反映: Nodeは.localhostをDNS解決できないため、Vite proxyは127.0.0.1上のportlessへ接続し、portless getで得たhostnameをHostヘッダーへ設定する。changeOriginとshラッパーは使用しない。

検証: pnpm dev:realでclientは4369、api.mimiは4516へ動的割り当て。mimi.localhost:1355/api/worksとapi.mimi.localhost:1355/api/worksはいずれもHTTP 200。pnpm checkとpnpm testが成功。

レビュー反映: (1) vite.config.tsのexecFileSyncにshell:win32を追加（.binの.CMDシムはshellなしで実行不可のため）。(2) backlog:browserはsh -cを廃止し、rootのportlessキー{name:backlog, appPort:6420}と--port 6420の固定ポート方式へ変更（人間用でworktree並行起動しない前提。動的ポートのNodeラッパー案は不採用）。proxy経由(Host: backlog.localhost)と直接6420の両方でHTTP 200を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
portlessを0.15.4へ更新してルート依存へ集約し、portless名はpackage.jsonのportlessキーへ移動（client=mimi、server=api.mimi）。dev:realはserverをportlessサービスとして動的ポート起動し、clientはvite.config.tsでportless getによりworktree対応のAPIホスト名を解決、127.0.0.1:1355へのHostヘッダールーティングで接続（Nodeが.localhostをDNS解決できないため）。固定localhost:8080を廃止。execFileSyncはshell:win32でWindowsの.CMDシムに対応。backlog:browserはsh -cを廃止し、rootのportlessキー(appPort:6420)による固定ポート方式へ変更。検証: pnpm check・pnpm test全通過（server 149 / client 202）、mimi・backlog両URLのHTTP 200確認。
<!-- SECTION:FINAL_SUMMARY:END -->
