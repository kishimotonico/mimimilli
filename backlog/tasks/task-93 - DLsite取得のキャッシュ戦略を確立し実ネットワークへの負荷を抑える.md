---
id: TASK-93
title: DLsite取得のキャッシュ戦略を確立し実ネットワークへの負荷を抑える
status: Done
assignee: []
created_date: '2026-07-25 08:38'
updated_date: '2026-07-26 02:03'
labels: []
dependencies: []
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

DLsiteスクレイピングには「HTTPレスポンスのキャッシュ」が存在しない。現状キャッシュ相当の役割を果たしているのは work_dlsite.status（applied/not_found/skipped は一括取得の対象から除外される: server/src/adapters/real/index.ts:629-633）だけで、これは作品レコードに紐づく状態であってレスポンスのキャッシュではない。

そのため以下でDLsiteへ実リクエストが飛ぶ:

- 手動プレビュー取得 POST /dlsite/:id/fetch はキャッシュを一切見ずに毎回fetchする（index.ts:545-554）
- DBを作り直す / .meta.json を消す / 作品を再登録するなど、デバッグで日常的に起きる操作で status がリセットされ、全件が再取得対象に戻る
- status=error の作品は毎回リトライ対象になる
- 同一RJコードを持つ作品が複数あると、作品ごとに個別リクエストが飛ぶ（RJ単位の重複排除がない）
- カバー画像DL（server/src/adapters/real/dlsite.ts:128-140）はリクエスト間隔制御の外にある

さらに、レート制御は runDlsiteBulk 内の逐次sleep（既定1000ms、index.ts:212 にハードコード、本番から設定不可）のみで、リトライ・指数バックオフ・Retry-After尊重も一切ない。

## 目的

作品状態とは独立した「長期TTLのレスポンスHTMLキャッシュ」を導入し、デバッグで何度スキャンしてもDLsiteの実サーバーへ繰り返しリクエストが飛ばない状態にする。あわせて全DLsiteリクエストを単一のレート制限スケジューラに集約する。

## 設計方針

キャッシュするのは**パース済みDTOではなく生のレスポンスHTML**。キャッシュの目的はサーバーへのアクセスを減らすことであって、パース処理の省略ではない。HTMLで持てば、パーサ改修後も同じHTMLに繰り返しスキャンをかけて検証でき、キャッシュ側でパーサのバージョン管理をする必要もなくなる。

保存先は**専用の SQLite（dlsite-cache.sqlite）1ファイル**。gzip圧縮したHTML本体もメタデータも同一DBに置き、1トランザクションで更新する。本体をファイル、インデックスをDBに分ける案は、本体欠損・orphan・更新途中クラッシュといった整合性ルールを個別に設計する必要が出るため採らない。作品を消してもcatalog DBを作り直してもキャッシュが残ることが要件。

「HTTP取得の成否」と「パースの成否」を分ける。2xxでもbot challengeや年齢確認ページが返りうるため、パース失敗を ok として長期キャッシュしない。

work_dlsite.status は表示・適用の状態に限定し、再取得の可否はキャッシュのTTLで決める。現状の status による恒久除外を残したままだとTTLが意味を持たないため、ここは整理が必要。

デバッグ用のアクセス制御は環境変数のbooleanフラグ1つに留める（モードの多段化はしない）。実ファイルを対象にしたスキャンを回しつつDLsiteだけ遮断したい、というのが唯一の要件で、MIMIMILLI_ADAPTER=fixture では静的データになってしまいこれを満たせない。

## サブタスク

1. TASK-93.1 レスポンスHTMLの永続キャッシュ（専用SQLite、既定TTL 30日）
2. TASK-93.2 全呼び出し経路のキャッシュ統合とwork_dlsite.statusの責務分離
3. TASK-93.3 レート制限・リトライの一元化とオフラインフラグ

## 検討経緯

Codexへ設計相談した結果、以下を計画へ反映した: HTTP成否とパース成否の分離、work_dlsite.status によるnot_found恒久除外とTTLの矛盾、single-flight、coverUrlのSSRF検証、カバーキーへの画像URLハッシュ、レスポンスサイズ上限、保存方式のBLOB採用、「ファイルを置くだけの自動インデックス再構築」の削除。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 サブタスク3件がすべてDoneであること
- [x] #2 同一環境でスキャン→一括取得を2回連続実行したとき、2回目のDLsiteへの実HTTPリクエスト数が0であること（DB・.meta.jsonを削除して作品を再登録した場合も0であること）
- [x] #3 キャッシュされるのは生HTMLであり、パーサを変更しても再取得なしで結果を再評価できること
- [x] #4 環境変数のフラグ1つで、実ファイルを対象にしたスキャンをDLsiteへ一切アクセスせず完走できること
- [x] #5 docs/ にDLsiteキャッシュ戦略が明文化されていること
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-93.1で作品DBから独立したHTMLキャッシュ基盤と、運用CLIを確立する。
2. TASK-93.2でHTTP取得とHTMLパースを分離し、手動fetch・一括取得・カバー画像をキャッシュ層へ統合する。work_dlsite.statusは表示・適用状態だけに使う。
3. TASK-93.3で全実HTTPを単一transport/schedulerに通し、オフライン・レート制限・再試行を集約する。
4. docs/の運用文書とdocs/README.mdの導線をTASK-93.3で整備し、親タスクの受け入れ条件をサブタスク完了後に確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装は 3ea70a9 / 7fb76ae / 8f1792e。レビューとCodexへの設計相談を経て、キャッシュの状態をsnapshotとfailureの2テーブルへ分離し、期限切れエントリがあるとネガティブキャッシュが書かれない不具合とschedulerのcooldown競合を修正した。1cddeb8 で resource_kind 次元など未使用の抽象を削除している。残件はTASK-98（テスト注入口の集約）、TASK-99（環境変数の削減）、TASK-100（容量の実測）、DRAFT-31（一括の明示refresh）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品状態と独立した専用SQLiteに生のレスポンスHTMLをgzipで保存し、デバッグでスキャンを繰り返してもDLsiteへ再リクエストが飛ばないようにした。HTTP取得の成否とパースの成否を分離し、全リクエストを単一schedulerへ集約してレート制限とバックオフを一元化。MIMIKAGO_DLSITE_OFFLINEで実HTTPを遮断できる。pnpm check / pnpm test で検証（server 319 / client 301）。
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 受け入れ条件に対応する実装・テスト・必要なドキュメントを完了している
- [x] #2 pnpm check が通る
- [x] #3 pnpm test が通る
<!-- DOD:END -->
