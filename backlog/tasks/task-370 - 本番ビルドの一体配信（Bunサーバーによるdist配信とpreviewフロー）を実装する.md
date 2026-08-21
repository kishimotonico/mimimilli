---
id: TASK-370
title: 本番ビルドの一体配信（Bunサーバーによるdist配信とpreviewフロー）を実装する
status: To Do
assignee: []
created_date: '2026-08-21 11:15'
labels: []
dependencies: []
ordinal: 370000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm dev（Vite dev server）は未バンドルのモジュールを1ファイル=1リクエストで配信するため、SSH越し・別PCブラウザの環境では読み込みが重い。本番ビルドで動作確認できる一体配信フローを整備する。

背景:
- client には vite build / vite preview が既にあるが、server が client/dist を配信する経路は無い（server/src/app.ts は /api のみ）
- ADR-0018 で「BunがVite distを配信するproduction経路」はスコープ外とされていた。ADR-0007 には将来構想として記載あり。今回これを実装するため新規ADR（0024）を起こす
- vite.config.ts のAPIプロキシは dev（command === "serve"）限定のため、previewはサーバー一体配信で解決する

実装方針:
- server に client/dist の静的配信＋SPAフォールバックを追加。distが無い場合やdev時はマウントせず現行のAPIオンリー挙動を維持
- ルートに preview 系 script を追加（例: preview / preview:fixture:new-work など）。client build → portless run bun server/src/index.ts の流れで、既存の [<ブランチ名>.]mimi.localhost:1355 のURL体系を維持する
- fixtureシナリオは既存の MIMIMILLI_ADAPTER / MIMIMILLI_MOCK_SCENARIO 環境変数をそのまま使う
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ルートの preview 系 script 一発で client のビルドとサーバー起動が行われ、mimi.localhost:1355 で本番ビルドのUIが表示される
- [ ] #2 worktree でもブランチ名サブドメイン（<ブランチ名>.mimi.localhost:1355）で preview を利用できる
- [ ] #3 fixture 各シナリオ（default/large/new-work/empty/errors）を環境変数またはscriptで切り替えて preview 起動できる
- [ ] #4 preview 環境で主要画面の表示・カバー画像・音声再生（Range配信）が動作する
- [ ] #5 dist が無い場合や dev 起動時は静的配信がマウントされず、既存の dev フローに影響が無い
- [ ] #6 新規ADR 0024 として Bun サーバーによる dist 配信の決定を記録し、ADR-0018 との関係を明記する
<!-- AC:END -->
