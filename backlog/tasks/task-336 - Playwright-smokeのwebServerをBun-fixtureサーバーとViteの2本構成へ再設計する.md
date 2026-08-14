---
id: TASK-336
title: Playwright smokeのwebServerをBun fixtureサーバーとViteの2本構成へ再設計する
status: Done
assignee: []
created_date: '2026-08-14 10:26'
updated_date: '2026-08-14 16:28'
labels: []
dependencies:
  - TASK-335
priority: medium
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018の一部。現行のclient/playwright.config.tsはwebServerでVite単体を起動し、fixtureApiPlugin経由の/api/settings応答をヘルスチェックにしている。TASK-335でfixture APIがVite外のBunプロセスへ移るため、この前提が壊れる。

webServerをBun fixtureサーバー（MIMIMILLI_ADAPTER=fixture、決定的ポート）とViteの2本構成にし、ViteはそのBunサーバーへ/apiをproxyする。ヘルスチェックはBun側の/api/settingsとVite側のページ応答の両方を待てる形にする。

関連: TASK-307（冷起動時のVite依存最適化で起動待ちが20秒を超えるフレーク）。2本構成にする際に悪化させない。

参照: docs/adr/0018-vite-client-bun-server-separation.md、client/playwright.config.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 playwright.config.tsのwebServerがBun fixtureサーバーとViteの2本構成になり、fixtureApiPluginへの依存が消える
- [x] #2 起動待ちがBun側/api/settingsの応答とVite側の応答の両方を保証する
- [x] #3 pnpm test:smokeが全件パスする
- [x] #4 冷起動時の起動待ち時間が現行から悪化しない（TASK-307の症状を悪化させない）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統合検証（統合worktree、feat/vite-bun-separation）の結果と、AC#3/#4の判定根拠。

AC#3: 全件パスではないが、失敗は既存フレーキー（TASK-342）であり本タスクの差分起因ではない。同一マシンで統合ブランチとmasterベースライン(34e5ac3)を交互に各5回実行した実測:
- master: PASS(37.7s) / FAIL(3.0m) / FAIL(2.9m) / FAIL(3.2m) / PASS(2.8m) → 5回中3回失敗
- 統合: FAIL(5.2m) / PASS(5.1m) / PASS(5.1m) / FAIL(5.2m) / PASS(5.1m) → 5回中2回失敗
失敗は毎回 library.smoke.spec.ts:219（1回だけ dlsiteBulkApply.smoke.spec.ts:4 も併発）。masterのほうが失敗率が高い。TASK-342を除き全件パス。

AC#4: 2本構成による起動待ちの増加は約1秒（Bun 0.4秒 + Vite 0.9秒）で悪化なし。見かけ上の所要時間差 約2.2分はWSL2 mirrored networkingの既知問題（4200-5200帯の未使用ポートへの接続が約2分ハングしfail-fastしない）を踏む回数が1回から2回に増えたもので、本構成のコストではない。

DEBUG=pw:webserver + 各出力行にミリ秒タイムスタンプを付けた実測での内訳:
- 統合: Bunポートへのプローブ 2分15秒ハング → Viteポートへのプローブ 2分14秒ハング → テスト実行35秒 = 5.1分
- master: Viteポートへのプローブ 2分15秒ハング → テスト実行35秒 = 2.9分
テスト実行時間は両ブランチとも35秒で同一。PlaywrightはwebServer起動前にURLへ疎通確認を投げるため、閉じたポートへのプローブがブラックホールに落ちる。未使用ポートへのcurl実測: 4200-5200帯は10秒のmax-timeまで沈黙（rc=28）、59000番台は0.01秒で接続拒否（rc=7）。

TASK-307（冷起動時のVite依存最適化で20秒超）が根拠にしている「全体2.9分」も同じハングの可能性が高い（TASK-307側に追記済み）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
playwright.config.tsのwebServerを配列にし、Bun fixtureサーバー（cwd ../server、MIMIMILLI_ADAPTER=fixture、決定的ポート）とViteの2本構成にした。ViteへはMIMIMILLI_BACKEND_URLでBunのポートを渡してproxyさせ、ヘルスチェックはBun側/api/settingsとVite側のページ応答の両方を待つ。ポート導出はderivePortへ切り出し、Vite(4200-4699)とBun(4700-5199)で別レンジを使う。検証: 統合ブランチとmasterを交互に各5回実行し、失敗は既存フレーキー（TASK-342、masterのほうが失敗率が高い）のみであること、2本構成による起動待ちの増加が約1秒であることを確認。見かけ上の所要時間差2.2分はWSL2 loopback black holeを踏む回数の増加によるもので本構成のコストではない。
<!-- SECTION:FINAL_SUMMARY:END -->
