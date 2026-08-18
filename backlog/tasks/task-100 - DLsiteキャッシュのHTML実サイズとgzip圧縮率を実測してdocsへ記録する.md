---
id: TASK-100
title: DLsiteキャッシュのHTML実サイズとgzip圧縮率を実測してdocsへ記録する
status: To Do
assignee: []
created_date: '2026-07-26 02:02'
updated_date: '2026-08-18 22:57'
labels: []
dependencies: []
priority: low
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

TASK-93.1 の計画時に「HTMLの実サイズとgzip圧縮率を実測し、想定容量を実装メモに記録する」を受け入れ条件に入れたが、実装は一貫して実ネットワークへ出さない方針で進めたため、**実測は未実施のまま**になっている。

docs/dlsite.md に書かれている容量の見積もりは推測であって実測値ではない。

## やること

実ページの試料を用意して測定し、docsの記述を実測値に置き換える。

試料の入手経路は次のいずれか。**このタスクのために新規で大量のリクエストをDLsiteへ送らないこと。**

- 別プロジェクトで既に取得済みのHTMLキャッシュを `pnpm --filter @mimimilli/server dlsite-cache -- import --dir <path>` で投入し、キャッシュDBから測定する
- 通常の利用の過程で自然に溜まったキャッシュを測定する

測定したいのは次の3点。

- 1ページあたりの非圧縮サイズの平均と分布（最小・最大）
- gzip後のサイズの平均と圧縮率
- N件あたりのキャッシュDBサイズの実測（`dlsite-cache status` で取れる）

## 注意

現在の転送上限は2 MiB、展開上限は8 MiB（server/src/adapters/real/dlsiteCache.ts:17-18）。実測の結果これらが実態に合っていない（余裕がなさすぎる、あるいは過大）と分かった場合は、既定値の見直しもこのタスクに含める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実ページ試料に基づく非圧縮サイズ・gzip後サイズ・圧縮率の実測値がある
- [ ] #2 N件あたりのキャッシュDBサイズの実測値がある
- [ ] #3 実測のために新規の大量リクエストをDLsiteへ送っていない
- [ ] #4 転送上限2MiB・展開上限8MiBが実態と乖離していないか確認し、必要なら既定値を見直している
- [ ] #5 docs/dlsite.md の容量に関する記述が推測から実測値に置き換わっている
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-07-30 の棚卸しで判明した記述の陳腐化】

- 参照先の docs/dlsite-cache.md は docs/dlsite.md へ統合済み。AC #3 の対象も docs/dlsite.md に読み替えること
- 現行の CLI は pnpm --filter @mimimilli/server dlsite-cache -- import --dir <path>
- status() が返す entries は HTML snapshot だけでなく failure も含む。件数あたりのサイズを出すときに failure を分母へ入れるかどうかで数字が変わる
- bytes は SQLite 本体に加えて WAL / SHM を含む。計測時にどこまでを容量とみなすかを決めること
- 転送上限 2MiB / 展開上限 8MiB は server/src/adapters/real/dlsiteCache.ts:14-15 に現存

【計測条件を先に決めること】

結果を再現可能にするため、着手時に次を決めてから測る。条件が決まっていないと「実測値」が一度きりの数字になり、AC #1/#2 を満たしたことにならない。

- 試料数（何件のキャッシュで測るか）
- failure エントリを集計に含めるか
- 測定用 DB を新規に作るか既存を使うか
- 平均・中央値・最大値のどれを記録するか
- 圧縮率の定義（非圧縮サイズ / gzip 後サイズ の比か、その逆か）

なお AC #4 のとおり、実測のために DLsite へ新規の大量リクエストを送らないこと。既存キャッシュを試料にする。

【2026-08-03 スキップ判断】実測に必要な実キャッシュデータが不足しているため着手見送り。WSLデータルート(~/.local/share/mimimilli/db/dlsite-cache.sqlite)を確認したところ dlsite_html_snapshots は4件のみ（failures 0件）。平均・分布・圧縮率を統計として出せる試料数ではなく、AC#4により新規大量リクエストでの試料収集も不可。通常利用でキャッシュが数百件規模まで溜まった時点で再着手する。
<!-- SECTION:NOTES:END -->
