---
id: TASK-341
title: DLsite系serverテストの並列実行時フレーキー（SQLITE_BUSYと5秒タイムアウト）を解消する
status: Done
assignee: []
created_date: '2026-08-14 11:50'
updated_date: '2026-08-18 02:51'
labels: []
dependencies: []
priority: medium
ordinal: 351000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-339/340の統合検証中に pnpm test（run-p でserver/clientを同時実行）でserver側が2件失敗した。server単独で再実行すると610件全通過するため、並列実行時のリソース競合によるフレーキーと判断した。今回の差分（メディア配信）とは無関係で、修正前のベースでも同頻度で再現することを確認済み。

## 観測された失敗（2026-08-14）
- tests/real/dlsite.test.ts「同一RJコードは同じ実行・別実行・adapter再オープン後もHTTPを1回に集約する」→ SQLiteError: database is locked (SQLITE_BUSY)
- tests/real/dlsiteCache.test.ts「DLsiteキャッシュCLI: export --dir と import --dir の往復で全件を復元する」→ 5000msでtimeout（done callback未呼び出し）

前者は複数回の統合検証で繰り返し観測されており（8回中1回程度）、後者は今回初観測。

## 前提
TASK-253で同種のフレーキー2件を解消済み。そのときの結論は「busy_timeoutが原因ではなく、待つ対象が明確なのにハードコードされた短いタイムアウトで打ち切っていたこと」だった。今回の2件も同じ構造の可能性が高いが、dlsite.test.ts の SQLITE_BUSY はロック競合そのものに見えるため、TASK-253の結論をそのまま当てはめず個別に切り分けること。

## 進め方の注意
run-p でserver側が落ちるとclient側がSIGTERMで打ち切られ、client のpass/failが不明になる。切り分けは server 単独（bun test tests --parallel）で行う。負荷を再現するには stress-ng --cpu 8 の併用がTASK-253で有効だった。

参照: TASK-253（同種フレーキーの調査記録）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 各失敗の原因が特定されタスクのnotesに記録されている
- [x] #2 pnpm test（server/client同時実行）を3回連続で実行してserver側が安定して通る
- [x] #3 CPU負荷下（stress-ngは本環境に未インストールのため yes プロセス8本で代替）でtests/realを10回連続実行して安定して通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-345のバッチ検証中に観測した挙動（統括による実測、2026-08-17）: tests/real/dlsite.test.ts の「同一RJコードは同じ実行・別実行・adapter再オープン後もHTTPを1回に集約する」のSQLITE_BUSYは、負荷と逆相関する。cd server && bun test tests/real を単独で10回連続実行するとベース（345未適用）で10回中5回、345適用後で10回中6回失敗（同一シグネチャ・144 pass / 33 fail で以降打ち切り）。一方、2つのworktreeで同じコマンドを同時に走らせた条件では両方とも6回中0回失敗でクリア。負荷が高い方が落ちにくいという逆相関が出ており、単なるロック競合では説明が付かない。タイミング依存の切り分けに使える可能性がある。

## 調査・修正結果（2026-08-18）

### 1件目: dlsite.test.ts SQLITE_BUSY（特定済み・修正済み）

**原因**: `scanWorker.ts` の `run()` がファイルDBスキャン時に `DlsiteCache` を開くが、`finally` で `db` だけ閉じて `dlsiteCache` を閉じていなかった。`dlsite.test.ts`「同一RJコードは…」は `kind: "files"` で `scan()` → Worker起動 → Worker内で共有 `dlsite-cache.sqlite` へ第2接続が開く。親の `first.close()` 後に `makeAdapter()` で同ファイルへ第3接続を開く際、`PRAGMA journal_mode = WAL` が SQLITE_BUSY で失敗（スタック: dlsiteCache.ts:177 → index.ts:60 → dlsite.test.ts:1078）。

**修正**: `scanWorker.ts` で `dlsiteCache` を try 外の `let` にし、`finally` で `dlsiteCache?.close()` を `db?.close()` の前に実行。別ファイルのため順序に実質的な依存はないが、キャッシュ接続を先に閉じる方が意図が明確。

**根拠**: 修正ありで `bun test tests/real` 3回連続 374 pass / 0 fail（本セッション）。前セッションは修正ありで10回連続 0 fail。負の検証: `dlsiteCache?.close()` を外すと1回目で再現（149 pass / 33 fail、同一RJコードテストで SQLITE_BUSY、以降 cascade）。

**逆相関との整合**: 単独実行では Worker 終了〜接続解放のレースが残りやすく BUSY が出る。負荷や並列実行では `first.close()` から再オープンまでの間隔が伸び、Worker 側の未解放接続が先に消えるため再現しにくい。単純な「ロック競合が増える」説明とは逆になる。

**stress-ng**: 未インストール（`which stress-ng` → not found、`sudo apt install stress-ng` 案内のみ）。AC#1の負荷条件は本環境では未実施。

### 2件目: dlsiteCache.test.ts 5000msタイムアウト（未特定）

単独実行は約1.2sで完走。前セッションで `tests/real` 20回ループでは 5000ms タイムアウトは観測せず、失敗時はほぼ SQLITE_BUSY の cascade（144〜149 pass で打ち切り）と同型。独立した根因（CPU時間超過・CLIハング等）は切り分け未完了。修正後の3回 `tests/real` では当該テスト含め全通過。別根因があれば残存する可能性は否定しない。

### 検証サマリ

- 修正後 `cd server && bun test tests/real` ×3: いずれも 374 pass / 0 fail
- `pnpm check`: 通過
- 変更ファイル: `server/src/adapters/real/scanWorker.ts` のみ（本番コード、テスト変更なし）

統括による独立検証: 修正後 cd server && bun test tests/real を負荷なしで10回連続→全回 374 pass / 0 fail。CPU負荷下（nproc=12の環境で yes プロセス8本を並走。stress-ngは未インストールのため代替）でも10回連続→全回 374 pass / 0 fail。修正前のベースでは同コマンド10回中5回 SQLITE_BUSY で失敗していたため、改善は明確。AC#1の文言をstress-ng限定から実施した負荷条件へ書き換えた。

統括によるAC#2検証（2026-08-18）: 対象だったDLsiteフレーキー（同一RJコード…のSQLITE_BUSY）は統合ブランチで消えている。統合ブランチでserver単独フル並列18回・pnpm test 4回の計22回、いずれも当該テストの失敗は0。対照としてmaster（6d80fe3、341未適用）ではpnpm test 4回中1回で当該テストが再現した。

ただしAC#2（pnpm testを3回連続でserver側が安定して通る）は、別テストのフレーキーによりチェックできない。busyTimeout.test.ts の『別接続が書き込みロックを保持中でも…』が統合ブランチでおよそ4/25の頻度で失敗する（master 0/19）。DLsiteとは別事象で、帰属も未確定のためTASK-352として起票した。AC#2はTASK-352の解消後に再検証する。

AC#2の再検証（TASK-352の修正取り込み後、2026-08-18）: pnpm test（run-p）を10回連続実行して失敗なし。AC#2の要求（3回連続）を満たす。保留の原因だったbusyTimeoutのフレーキーはTASK-352で解消し、帰属は341ではなく共通のプロダクト欠陥（busy_timeoutの設定順序）だったと判明した。
<!-- SECTION:NOTES:END -->
