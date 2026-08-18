---
id: TASK-353
title: DLsiteキャッシュCLIのexport/import往復テストの5秒タイムアウトを解消する
status: In Progress
assignee: []
created_date: '2026-08-18 03:47'
updated_date: '2026-08-18 03:48'
labels: []
dependencies: []
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests/real/dlsiteCache.test.ts の「DLsiteキャッシュCLI: export --dir と import --dir の往復で全件を復元する」が、負荷の高い実行時に5000msのテストタイムアウトで失敗する。

TASK-341の2件目として起票されていたが、当時は原因未特定のまま残っていた（341の1件目=SQLITE_BUSYは解消済み、TASK-352で根本原因のbusy_timeout設定順序も解消）。フレーキーバッチの最終検証で再現したため独立したタスクとして切り出す。

## 実測（統括、2026-08-18。統合ブランチ feat/flaky-tests）

- 単体実行 bun test tests/real/dlsiteCache.test.ts: 10回連続で失敗0
- ルートの pnpm test（run-p でserver/clientを同時実行）: 9回中2回失敗（5194ms / 5452ms でタイムアウト）

負荷が高い条件でのみ再現する。SQLITE_BUSYのcascadeではなく、当該テスト単独のタイムアウトとして出る。

## 前提

TASK-253の結論は「busy_timeoutが原因ではなく、待つ対象が明確なのにハードコードされた短いタイムアウトで打ち切っていたこと」だった。本件も、CLIの処理完了を待つべきところを5秒の固定タイムアウトで打ち切っている可能性がある。ただしTASK-341の1件目ではこの結論をそのまま当てはめられなかった実績があるので、個別に切り分けること。

## 進め方

まず「本当に処理が終わっていないのか、終わっているのに待ち方が悪いのか」を切り分ける。負荷下で実際に何秒かかっているかを計測し、5秒が単に足りないだけなのか、どこかで待ちが発生しているのかを判定すること。タイムアウト値を伸ばすだけの対処は不可（それが妥当だと判断する場合は、計測値にもとづく根拠を示すこと）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 負荷下での実所要時間が計測され、タイムアウトの原因（処理が遅いのか待ち方が不適切なのか）が特定されタスクnotesに記録されている
- [ ] #2 原因構造が修正されている（固定タイムアウトの延長のみで済ませる場合は計測にもとづく根拠が示されている）
- [ ] #3 ルートのpnpm testを10回連続実行して当該テストが失敗しない
<!-- AC:END -->
