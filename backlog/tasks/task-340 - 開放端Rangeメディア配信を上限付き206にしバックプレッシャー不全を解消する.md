---
id: TASK-340
title: 開放端Rangeメディア配信を上限付き206にしバックプレッシャー不全を解消する
status: In Progress
assignee: []
created_date: '2026-08-14 10:39'
updated_date: '2026-08-14 12:11'
labels: []
dependencies:
  - TASK-339
priority: medium
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-339の調査で発見した別問題の修正。

## 問題（実測で確認済み）
streamWithRange（server/src/routes/media.ts:135-215）は開放端Range（bytes=N-）やRange無しに対しファイル残り全体を1本のResponseストリームで返す。実測では、クライアントが100KBしか受信していない時点でサーバー側のcreateReadStreamが0.3秒で64MB全量を読み切ってcloseしていた。つまりReadable.toWeb→Responseの経路でバックプレッシャーがファイル読み取りへ伝わらず、リクエストされた範囲の全量がメモリに載る。3時間級の音声ファイルなら1リクエストで数百MB。

また1接続が数十分生存する前提の配信は、経路上のあらゆるタイムアウト（Bun idleTimeout、プロキシ等）に脆弱。TASK-339のtimeout無効化への依存度もこの修正で下がる。

## 修正方針
- 開放端Range（bytes=N-）は上限チャンクサイズ（数MB程度、値は実装時に決定）で打ち切った206を返す。Content-Rangeで実際に返す範囲を正しく宣言すれば、Chromeは残りを次のRangeリクエストで取りに来る（HTTP仕様上、206は要求より短い範囲を返してよい）
- 明示的な閉区間Range（bytes=N-M）は従来どおり
- Range無しの200経路の扱い（上限を設けるか、そのままか）は実装時に判断。audioはブラウザが常にRangeを付けるため実害は小さい
- バックプレッシャー不全自体の解消（チャンク上限で読み取り量が有界になるため実質解消される。Readable.toWebの挙動深掘りは不要）

## 参照
- server/tests/real/media.test.ts（既存のRange 206テスト。30-44行目）
- server/tests/fixtureMedia.test.ts（synthetic経路の206テスト）
- parseRange: media.ts:218-242（開放端でend=fileSize-1になるのは236行目）

## 関連
- TASK-339（idleTimeout切断修正）の後続
- TASK-337（transport smoke）と相互参照。TASK-337の「限界」に実ファイルstream+Range未検証と明記されており、本タスクのテストがそれを補完する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 開放端Range（bytes=N-）に対して上限チャンクサイズで打ち切った206とContent-Rangeが返る（テストで検証）
- [x] #2 閉区間Range（bytes=N-M）は従来どおり指定範囲全体を返す
- [x] #3 配信中のサーバー側ファイル読み取り量がチャンク上限で有界になる（全量先読みが起きない）
- [ ] #4 Chromeでの通し再生・シークが正常動作する（実機確認を受け入れ条件に含む）
- [ ] #5 pnpm check と server側テストが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装・自動テストは完了し統合ブランチ feat/media-connection-lifetime にマージ済み（99ea67c）。上限8MiB、開放端Range（bytes=N-）のみ丸め、閉区間と末尾指定は従来どおり、200経路は上限なし。残るはAC#4のChrome実機確認のみ（この開発環境はSSH越しWSLのため実施不可。別PCでの確認待ち）。確認内容: 長時間の通し再生が停止しないこと、シークが正常に動作すること。
<!-- SECTION:NOTES:END -->
