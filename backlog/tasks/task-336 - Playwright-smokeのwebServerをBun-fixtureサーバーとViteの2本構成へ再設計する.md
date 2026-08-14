---
id: TASK-336
title: Playwright smokeのwebServerをBun fixtureサーバーとViteの2本構成へ再設計する
status: In Progress
assignee: []
created_date: '2026-08-14 10:26'
updated_date: '2026-08-14 13:39'
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
