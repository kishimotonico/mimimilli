---
id: TASK-100
title: DLsiteキャッシュのHTML実サイズとgzip圧縮率を実測してdocsへ記録する
status: To Do
assignee: []
created_date: '2026-07-26 02:02'
labels: []
dependencies: []
priority: low
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

TASK-93.1 の計画時に「HTMLの実サイズとgzip圧縮率を実測し、想定容量を実装メモに記録する」を受け入れ条件に入れたが、実装は一貫して実ネットワークへ出さない方針で進めたため、**実測は未実施のまま**になっている。

現在 docs/dlsite-cache.md に書かれている容量の見積もり（1ページ数百KB、gzipで1/8〜1/10、1万作品で数百MB規模）は推測であって実測値ではない。

## やること

実ページの試料を用意して測定し、docsの記述を実測値に置き換える。

試料の入手経路は次のいずれか。**このタスクのために新規で大量のリクエストをDLsiteへ送らないこと。**

- 別プロジェクトで既に取得済みのHTMLキャッシュを `pnpm backlog` ではなく `pnpm --filter server dlsite-cache import --dir <path>` で投入し、キャッシュDBから測定する
- 通常の利用の過程で自然に溜まったキャッシュを測定する

測定したいのは次の3点。

- 1ページあたりの非圧縮サイズの平均と分布（最小・最大）
- gzip後のサイズの平均と圧縮率
- N件あたりのキャッシュDBサイズの実測（`dlsite-cache status` で取れる）

## 注意

現在の転送上限は2 MiB、展開上限は8 MiB。実測の結果これらが実態に合っていない（余裕がなさすぎる、あるいは過大）と分かった場合は、既定値の見直しもこのタスクに含める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実ページ試料に基づく非圧縮サイズ・gzip後サイズ・圧縮率の実測値がある
- [ ] #2 N件あたりのキャッシュDBサイズの実測値がある
- [ ] #3 docs/dlsite-cache.md の容量に関する記述が推測から実測値に置き換わっている
- [ ] #4 実測のために新規の大量リクエストをDLsiteへ送っていない
- [ ] #5 転送上限2MiB・展開上限8MiBが実態と乖離していないか確認し、必要なら既定値を見直している
<!-- AC:END -->
