---
id: TASK-341
title: DLsite系serverテストの並列実行時フレーキー（SQLITE_BUSYと5秒タイムアウト）を解消する
status: In Progress
assignee: []
created_date: '2026-08-14 11:50'
updated_date: '2026-08-17 19:13'
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
- [ ] #1 並列負荷下（stress-ng併用）で対象2テストを10回連続実行して安定して通る
- [ ] #2 各失敗の原因が特定されタスクのnotesに記録されている
- [ ] #3 pnpm test（server/client同時実行）を3回連続で実行してserver側が安定して通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-345のバッチ検証中に観測した挙動（統括による実測、2026-08-17）: tests/real/dlsite.test.ts の「同一RJコードは同じ実行・別実行・adapter再オープン後もHTTPを1回に集約する」のSQLITE_BUSYは、負荷と逆相関する。cd server && bun test tests/real を単独で10回連続実行するとベース（345未適用）で10回中5回、345適用後で10回中6回失敗（同一シグネチャ・144 pass / 33 fail で以降打ち切り）。一方、2つのworktreeで同じコマンドを同時に走らせた条件では両方とも6回中0回失敗でクリア。負荷が高い方が落ちにくいという逆相関が出ており、単なるロック競合では説明が付かない。タイミング依存の切り分けに使える可能性がある。
<!-- SECTION:NOTES:END -->
