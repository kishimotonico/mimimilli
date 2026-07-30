---
id: TASK-103
title: DLsite一括取得を中断できるようにする
status: Done
assignee: []
created_date: '2026-07-26 05:16'
updated_date: '2026-07-26 08:15'
labels: []
dependencies: []
documentation:
  - docs/dlsite.md
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャンジョブ（server/src/scanJobManager.ts）にはAbortControllerとキャンセルAPI（DELETE /scan/:id）があるが、DLsite一括取得にはキャンセル手段が一切ない。runDlsiteBulk（server/src/adapters/real/index.ts:873）のシグネチャは (mode, workIds, onProgress) のみでAbortSignalを受け取らず、POST /dlsite/bulk に対応する中断エンドポイントも存在しない。GET /dlsite/events の購読を切ってもサーバー側のジョブは走り続ける。

DLsiteへのリクエストは意図的に直列・最小間隔1000msで流しているため、キャッシュが全ミスの初回取得では1000件で約17分かかる。この間ユーザーがジョブを止める手段がないのは操作性の問題であり、外部サーバーへ流し続けるリクエストを止められないという点でも望ましくない。

中断してもやり直しコストは小さい。runDlsiteBulkはRJコード単位・作品単位で個別にトランザクションをコミットしており（index.ts:952-957, 1009-1021, 1045-1049、dlsiteCache.ts:269-298）、再実行時にキャッシュヒットした作品はスケジューラを経由せず1000ms待機も発生しない（index.ts:324-342）。つまり中断は「処理済みぶんを捨てる」操作にはならない。

実装済みのスキャンジョブのキャンセル機構（TASK-76）と同じ形に揃えるのが素直。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実行中のDLsite一括取得を中断するAPIがあり、進行中のジョブが実際に停止する
- [ ] #2 runDlsiteBulkがAbortSignalを受け取り、逐次ループの各イテレーション境界で中断を検知して打ち切る
- [ ] #3 中断時、それまでに取得・保存した結果は破棄されず残る
- [ ] #4 中断したジョブはerrorではなくcancelled相当の終端状態としてクライアントへ伝わる
- [ ] #5 中断後に再実行すると、取得済みの作品はキャッシュヒットで処理されHTTPリクエストが発生しない
- [ ] #6 クライアントから一括取得を中断できるUIがある
- [ ] #7 途中中断したジョブを再実行したとき処理済みぶんが再取得されないことを検証するテストがある
<!-- AC:END -->
