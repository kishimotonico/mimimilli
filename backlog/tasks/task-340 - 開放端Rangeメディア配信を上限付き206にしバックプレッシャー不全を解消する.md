---
id: TASK-340
title: 開放端Rangeメディア配信を上限付き206にしバックプレッシャー不全を解消する
status: In Progress
assignee: []
created_date: '2026-08-14 10:39'
updated_date: '2026-08-18 23:26'
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
- [x] #4 pnpm check と server側テストが通る
- [x] #5 打ち切られた206の続きをChromeが次のRangeリクエストで取得し、8MiB境界を跨いで再生が継続する（headless Chromeで確認）
- [ ] #6 実機Chromeでの長時間音声の通し再生とシークが正常動作する（ドッグフーディングで確認）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装・自動テストは完了し master にマージ済み（99ea67c → 統合 5cb40db）。統合ブランチ feat/media-connection-lifetime は削除済み。上限8MiB（server/src/routes/media.ts:28-29）、開放端Range（bytes=N-）のみ丸め（:207-208）、閉区間と末尾指定は従来どおり、200経路は上限なし。

自動テストの所在: server/tests/real/media.test.ts:46-69、server/tests/fixtureMedia.test.ts、server/tests/transport/range.test.ts:52-65。

残件はAC#4のChrome実機確認のみ。この開発環境はSSH越しWSLのため実施不可で、別PCでの確認待ち。確認内容: 長時間音声の通し再生が停止しないこと、シークが正常に動作すること。実機確認後にAC#5（pnpm check + server側テスト）を消化してクローズする。

## AC#4/#5 検証（2026-08-19、commit 007fc1b）

`pnpm check` exit 0。server側テストは `bun test tests/real` を10回連続で 374 pass / 0 fail（TASK-345のAC#5と同じ実行）。

### HTTPレベル（curl、fixture dev server、11,624,044バイトの合成WAV）
| リクエスト | 応答 |
|---|---|
| Rangeなし | 200 / 全量 11,624,044（200経路は上限なし＝仕様どおり） |
| `bytes=0-` | 206 / `bytes 0-8388607/11624044` |
| `bytes=8388608-` | 206 / `bytes 8388608-11624043/11624044`（残り3.2MBは上限未満で丸めなし） |
| `bytes=100-200` | 206 / 101バイト |
| `bytes=-500` | 206 / 末尾500バイト（末尾指定も丸めなし） |

### Chromeの追従（agent-browser、HAR実測）
キャッシュを避けた1回の再生で観測したRange連鎖:

    bytes=0-        -> 206 bytes 0-8388607/11624044        (8,388,608 = 8MiB ちょうど)
    bytes=8224768-  -> 206 bytes 8224768-11624043/11624044 (続きを取りに来た)
    bytes=262144-   -> 206 bytes 262144-8650751/11624044   (8,388,608 = 8MiB ちょうど)
    bytes=9273344-  -> 206 bytes 9273344-11624043/11624044 (続きを取りに来た)

打ち切られた206の直後に必ず続きのRangeを発行しており、**Chromeが短い206を正しく扱うことを確認**。

再生: 8MiB境界は 1048.6秒地点。980秒からの再生で 1327秒まで stall なしで通過し、buffered は全量 11,624,000 バイトに到達。シークは 1000秒→1400秒で `waiting → seeked → playing` と遷移し再生が再開。

### この確認の限界
- fixtureの合成WAV（`type: "synthetic"`、メモリ上の read()）を使っており、実ファイルの createReadStream 経路は通っていない。実ファイル側の読み取り量が有界であることは `server/tests/real/media.test.ts`（チャンク上限1000バイト）が担保している
- headless Chromeのため実際の音声出力は確認できない。数時間級の連続再生も未確認

残件はAC#6（実機Chromeでの通し再生・シーク）のみ。ドッグフーディング中に不具合が出なければ達成とみなす。
<!-- SECTION:NOTES:END -->
