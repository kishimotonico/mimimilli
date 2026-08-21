---
id: TASK-370
title: 本番ビルドの一体配信（Bunサーバーによるdist配信とpreviewフロー）を実装する
status: Done
assignee: []
created_date: '2026-08-21 11:15'
updated_date: '2026-08-21 11:37'
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
- [x] #1 ルートの preview 系 script 一発で client のビルドとサーバー起動が行われ、mimi.localhost:1355 で本番ビルドのUIが表示される
- [x] #2 worktree でもブランチ名サブドメイン（<ブランチ名>.mimi.localhost:1355）で preview を利用できる
- [x] #3 fixture 各シナリオ（default/large/new-work/empty/errors）を環境変数またはscriptで切り替えて preview 起動できる
- [x] #4 preview 環境で主要画面の表示・カバー画像・音声再生（Range配信）が動作する
- [x] #5 dist が無い場合や dev 起動時は静的配信がマウントされず、既存の dev フローに影響が無い
- [x] #6 新規ADR 0024 として Bun サーバーによる dist 配信の決定を記録し、ADR-0018 との関係を明記する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
根拠: docs/adr/0024-bun-static-dist-serving.md を新規作成。ADR-0018 のスコープ外事項（Bun dist 配信）を今回実装した旨と ADR-0007 との関係を記載。

根拠: staticServe.test.ts「staticDir 未設定時は非API GET が JSON 404」が createApp 無オプションで 404 JSON を観測。負の検証: app.ts で staticDir 未設定でも middleware を常時マウントすると同テストが 200≠404 で失敗。MIMIMILLI_STATIC_DIR 未設定時 index.ts は staticDir=undefined のまま serve。

根拠: package.json に preview:fixture（client build → portless mimi bun server/src/index.ts）を追加。curl http://mimi.localhost:1355/ が HTTP 200 + cache-control:no-cache + HTML を返し、一体配信が動作することを確認（2026-08-21）。portless 構文は portless mimi bun ...（run 不要）。

根拠: preview:fixture:large/new-work/empty/errors を追加し、各 script が MIMIMILLI_MOCK_SCENARIO を cross-env で preview:fixture に渡す。server/index.ts の createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO }) と既存 dev:fixture:* と同型。

根拠: portless dist/cli.js の handleNamedMode（portless mimi）は worktree プレフィックスを付けないが、handleRunMode（portless run --name mimi）は detectWorktreePrefix + applyWorktreePrefix を適用するため preview scripts を portless run --name mimi に変更。pnpm preview:fixture:new-work 起動ログに Prefix "370-production-preview" (from git branch) と -> http://370-production-preview.mimi.localhost:1355 を確認。curl --max-time 2 http://370-production-preview.mimi.localhost:1355/ が HTTP 200 + cache-control:no-cache + HTML。メイン worktree（worktreeCount<=1）では detectWorktreeViaCli が null を返し plain mimi.localhost になる（portless README Git Worktrees 節と同型）。

AC#4根拠: 検証担当がpreview（fixture new-work）で一覧・カバー画像・詳細表示・SPAリロードを実機確認。音声はRange配信を実測（curl 206/content-range、ブラウザネットワークでも206取得）。再生位置スライダーが進まない事象はdev環境（Vite）でも同一に再現し（対照実験、aria-valuenow 0のまま×3回）、headless・音声デバイスなし環境の制約でありpreview固有の問題ではないと判定。最終の実機再生確認は別PCでのユーザー確認に委ねる。

コミット前レビュー指摘対応: staticDir配下のシンボリックリンク経由でルート外ファイルが配信される問題をrealpathSync解決後のルート内チェックで修正（負の検証済み、staticServe.test.ts 12件）。/api誤マッチ（/apifoo）修正、ADR表記を実コマンド（portless run --name mimi）に統一。フル pnpm check / pnpm test は全pass（843 tests）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MIMIMILLI_STATIC_DIRで有効化するclient/dist静的配信（SPAフォールバック・assets immutableキャッシュ・シンボリックリンク/トラバーサルガード）をserverに追加し、preview:fixture(:シナリオ)/preview:realを整備。worktreeではブランチ名サブドメイン（portless run --name mimi）で起動。ADR-0024を新設。検証はcurl・ブラウザ実機（headless）・server/staticServe.test.ts 12件・フルcheck/testで実施。
<!-- SECTION:FINAL_SUMMARY:END -->
