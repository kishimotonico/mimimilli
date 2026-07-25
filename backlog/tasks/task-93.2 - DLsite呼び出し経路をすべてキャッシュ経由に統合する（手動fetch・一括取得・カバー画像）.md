---
id: TASK-93.2
title: DLsite呼び出し経路をすべてキャッシュ経由に統合する（手動fetch・一括取得・カバー画像）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-25 08:39'
updated_date: '2026-07-25 13:15'
labels: []
dependencies:
  - TASK-93.1
parent_task_id: TASK-93
priority: high
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## やること

DLsiteへ出ていく経路をすべてTASK-93.1のキャッシュ層の背後に置き、キャッシュヒット時はネットワークに出ないようにする。

キャッシュヒット時もパースは毎回実行する（キャッシュしているのは生HTML）。パース結果をキャッシュしないことは意図した設計で、パーサ改修後に同じHTMLで繰り返し検証できるようにするため。

### 対象経路

- 手動プレビュー取得 POST /dlsite/:id/fetch → dlsiteFetch (server/src/adapters/real/index.ts:545-554)。現状キャッシュを一切見ずに毎回fetchしており、UIで再表示・連打するたびに実リクエストが飛ぶ
- 一括取得 runDlsiteBulk (server/src/adapters/real/index.ts:616-743)
- カバー画像DL downloadCover (server/src/adapters/real/dlsite.ts:128-140)

fetchDlsiteInfo (dlsite.ts:76-112) の「取得」と「パース」を分離し、取得部分だけがキャッシュ層を経由する形にする。

### work_dlsite.status との責務分離

現状 status=not_found の作品は一括取得の対象から恒久的に除外される（index.ts:629-633）。このフィルタを残したままキャッシュにTTLを持たせても、not_found のTTLが切れた作品が再取得対象に戻らず、TTLが意味を持たない。

**work_dlsite.status は「表示・適用の状態」に限定し、再取得の可否はキャッシュのTTLで決める**ように整理する。作品状態とHTTP取得状態を分けるのが本タスク群の方針であり、ここもそれに合わせる。

### 同時実行の抑制（single-flight）

永続キャッシュだけでは、手動fetchと一括取得が同時に走ったときに同一キーで二重取得が起きる。少なくともプロセス内で、同一キーの進行中リクエストのPromiseを共有すること。

### RJ単位の重複排除

同一RJコードを持つ作品が複数ある場合、DLsiteへのリクエストは1回にまとめる。1回の一括実行内でも、実行をまたいでも1回であること。

### カバー画像

画像もキャッシュし、各作品フォルダーへはキャッシュからコピーして配置する。作品を消して再登録しても再ダウンロードしない。

キャッシュキーはRJコード単位では不足で、**正規化した画像URLのhashを含める**。RJ単位だけだと、HTML更新でcover URLが変わったときに古い画像が残り続ける。画像はパース対象ではないので圧縮せず保存してよい。

### カバーURLの検証（SSRF対策）

手動apply経路はクライアントから渡された coverUrl をそのまま downloadCover に流している（shared/src/dlsite.ts:40、server/src/adapters/real/index.ts:560）。現状は任意文字列を受け付けるため、HTTPSかつ許可したDLsite画像ホストに限定する。この経路が注入された dlsiteCoverDownloader を迂回している問題も、キャッシュ層への統合とあわせて解消する。

### 強制再取得

キャッシュを無視して取り直す明示的な手段を1つ用意する。既定は常にキャッシュ優先。強制再取得が失敗したとき、既存の ok エントリは削除せず保持し、通常のgetでは使わない扱いとする（デバッグ可能性とエラー非隠蔽の両立）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 取得（HTTP）とパースが分離され、キャッシュ層を経由するのは取得部分だけになっている
- [x] #2 キャッシュヒット時もパースは毎回実行され、パーサを変更すれば再取得なしで結果が変わることをテストで確認する
- [x] #3 POST /dlsite/:id/fetch がキャッシュを参照し、ヒット時はDLsiteへHTTPリクエストを送らない
- [x] #4 runDlsiteBulk がキャッシュを参照し、ヒット時はDLsiteへHTTPリクエストを送らない
- [x] #5 work_dlsite.status が再取得可否の判定に使われなくなり、not_found のTTLが切れた作品が再取得対象に戻ることをテストで確認する
- [x] #6 同一キーへの同時リクエストがsingle-flightで束ねられ、実HTTPリクエストが1回で済むことをテストで確認する
- [x] #7 同一RJコードの作品が複数ある場合、DLsiteへのリクエストは実行内・実行間ともに1回に集約される
- [x] #8 カバー画像が正規化画像URLのhashを含むキーでキャッシュされ、cover URLが変われば新しい画像が取得される
- [x] #9 カバー画像は作品フォルダーへコピーで配置され、作品を削除して再登録しても再ダウンロードが発生しない
- [x] #10 coverUrl がHTTPSかつ許可したDLsite画像ホストに限定され、それ以外は拒否されることをテストで確認する
- [x] #11 手動applyのカバー取得もキャッシュ層を通り、注入downloaderを迂回する経路が残っていない
- [x] #12 キャッシュを無視して強制再取得する手段が1つ存在し、既定では無効である。失敗時に既存のokエントリを削除しない
- [x] #13 DB・.meta.jsonを削除して作品を再登録するシナリオで、2回目のDLsiteへの実HTTPリクエスト数が0であることをテストで検証する
- [x] #14 期限切れエントリの再取得が失敗した場合、期限切れキャッシュへフォールバックせずエラーが伝播することをテストで確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. parseDlsiteHtml をpure parserとして維持し、HTTP取得をcache-firstの取得サービスへ分離する。TASK-93.1の生HTMLをhit時に読み出し、毎回パースするため、パーサ変更後も再HTTPなしで再評価できるようにする。
2. POST /dlsite/:id/fetch、一括取得、手動applyを含むカバー取得を同じ取得サービスへ統合する。既存の dlsiteFetcher / dlsiteCoverDownloader テスト注入点を置換・拡張し、TASK-93.3のtransport/schedulerを使う境界にする。
3. work_dlsite.statusを表示・適用状態に限定し、bulk対象の恒久除外をやめる。TTL切れnot_foundが再取得対象へ戻ること、同一RJ/VJコードは実行内・実行間で重複HTTPしないことを確認する。プロセス内ではキー単位single-flightで進行中Promiseを共有する。
4. 期限切れエントリは再取得を開始し、その再取得が失敗した場合は期限切れキャッシュへフォールバックせずエラーを伝播する。カバーは正規化した許可済みHTTPS DLsite画像URLのhashを含むキーで永続キャッシュし、作品フォルダーへコピーする。クライアント由来coverUrlも同じ検証・注入downloader経路を通す。強制再取得は明示指定だけで有効にし、失敗しても既存ok行を削除しない。
5. 一時DBと注入fetchを使い、手動fetch・bulk・apply、再登録後のcache hit、single-flight、status分離、期限切れ後の失敗伝播、cover URL変更・SSRF拒否・強制再取得を実ネットワークなしで統合試験する。実ページ試料の測定は最終統合・docsを担当するTASK-93.3で扱う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-93.1のストア契約を利用し、HTTP取得の統合だけを担当する。schedulerの実装はTASK-93.3で行う。

TASK-93.1から、期限切れ後の再取得失敗伝播と取得済み実ページfixtureの容量・圧縮率測定を移管した。

実装: 生HTML取得（dlsiteHtmlFetcher/fetchDlsiteHtml）とパースを分離し、HTML cache-first・同一キーsingle-flight・force=trueをreal adapterへ統合した。manual fetch / bulk は同じ経路を利用し、bulkの対象判定からnot_found/errorを除外するstatus依存を外した。カバーは許可済みHTTPS DLsite画像ホストを検証し、URL SHA-256キーの非圧縮SQLiteキャッシュから作品フォルダーへ書き出す。applyも同じ経路を通す。focused: server/tests/real/dlsite.test.ts 17件、dlsiteCache.test.ts 12件、server typecheck成功。実ページHTML fixtureはrepo内に無く、新規実HTTPアクセスはしないためAC #15（実測容量・圧縮率）は未完。pnpm test等の最終検証は検証担当へ委ねる。

追加確認: 期限切れ後のtransport失敗はstale HTMLを返さずerrorとなること、force失敗後も既存okを通常取得できること、apply/bulkのcoverがlegacy downloaderを使わずcache transportを通ることを統合テスト化。ルート pnpm check と pnpm test が成功（server 292件、client 301件）。AC #13（DB/.meta再作成後のHTTP 0回）と #15（実ページfixtureの実測）は未完のまま。

追加: cache hitでも注入parserが毎回呼ばれること、bulkの2回目がHTML HTTP 0件であることを統合テスト化。再確認: pnpm check、pnpm test成功（server 295件、client完走）。AC #7/#9/#13 は明示テスト未追加、AC #15 は実ページfixture不在で未完。

追加: 一時ライブラリ・ファイルDB・注入HTTPでAC #7/#9/#13を統合テスト化。#7は同一RJコードの複数作品を同一bulk・別bulk・adapter再open後に処理してHTML HTTP 1回を確認。#9はcover cacheから各作品フォルダーへの内容一致とcatalog削除後の再登録でcover HTTP追加0回を確認。#13はfresh DBと.meta.json削除後の同一物理作品再登録で2回目HTML HTTP 0回を確認。実ネットワーク未使用。pnpm check、pnpm test成功（server 298件、client 301件）。AC #15は未完、DoD/Doneは保留。

再レビュー修正: cover redirectをmanual追跡にし、許可外Locationを次fetch前に拒否。非443ポートとfragmentを正規化/拒否。force/normalのcache missは同一flightへ合流。force失敗は本文を保持してexpireし、期限切れokのnon-force 404はnot_found negativeへ更新する。明示統合テスト（parser再評価、bulk hit、同一RJ、cover再登録、DB/.meta再作成）を追加。pnpm check / pnpm test / git diff --check 成功（server 299件、client完走）。AC15のみ実ページfixture不在で未完。

AC #15の実ページfixture測定は、docs・最終統合を担当するTASK-93.3へ移管した。AC #11は本タスクで検証したキャッシュ層と注入downloaderの経路に限定し、レート制限の保証はTASK-93.3のAC #6/#7で扱う。

Solレビューおよび既報の検証結果に基づき、受け入れ条件14件とDoDを確認した。pnpm check、pnpm test、git diff --checkは成功済み（server 299件、client完走）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
HTTP取得とパースを分離し、手動fetch・bulk・applyのカバー取得をキャッシュ層へ統合した。single-flight、強制再取得、期限切れ再取得失敗の伝播、カバーの永続キャッシュとSSRF検証を統合テストで確認した。レート制限と実ページ試料の観測はTASK-93.3へ移管した。
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 受け入れ条件に対応する実装・テスト・必要なドキュメントを完了している
- [x] #2 pnpm check が通る
- [x] #3 pnpm test が通る
<!-- DOD:END -->
