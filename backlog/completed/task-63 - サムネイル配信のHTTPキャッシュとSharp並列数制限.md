---
id: TASK-63
title: サムネイル配信のHTTPキャッシュとSharp並列数制限
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 02:03'
updated_date: '2026-07-22 17:44'
labels: []
dependencies: []
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
サムネイル配信（server/src/routes/media.ts、adapters/real/thumbnailCache.ts）にETag/Last-Modified/Cache-Controlがなく、ブラウザキャッシュ・304が効かないため毎回getWork()+複数SQL+stat+配信が走る。また異なる作品の初回サムネイル生成はSharp変換の並列数が無制限で、初回グリッド表示や高速スクロール時にCPU・メモリが圧迫される（同一画像同一幅のsingle-flightはあり）。

方針: ETagまたはLast-Modifiedによる条件付きGET対応、可能ならバージョン付きURL+Cache-Control immutable。Sharp処理はキュー化してCPUコア数程度に同時実行を制限。事前一括生成はせずオンデマンド+限定並列を維持。サムネイルGCは低優先度の独立ジョブ化を検討。2026-07-19のパフォーマンス調査で中優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 サムネイル・カバー配信が条件付きGET（304）またはimmutableキャッシュで再取得を回避できる
- [x] #2 サムネイル生成の同時実行数が制限される
- [x] #3 pnpm check と pnpm test が通る
- [x] #4 ETagはrepresentation（作品×幅×元画像mtime）ごとに異なり、元画像変更で変わる。同一ETagのIf-None-Matchには304でbodyを返さない
- [x] #5 安定URLにimmutableを付けない（使う場合はバージョントークン付きURLに限る。DTOへのcover version搭載はTASK-58のDTO設計と調整）
- [x] #6 異なるキーの同時多数要求でも実行中のSharp変換数が上限以下。変換失敗時もキューslotが解放され、一時ファイルが残らない。既存single-flightは維持
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. cover専用の軽量descriptorをadapter境界に導入し、realはid/physicalPath/coverImageだけを取得して元画像statからrepresentation情報を解決する 2. workId・正規化width・元画像size・mtimeMsからweak ETagとLast-Modifiedを生成し、routeでIf-None-Match/If-Modified-Sinceを評価して304をSharp生成前に返す。Cache-Controlはprivate,max-age=0,must-revalidateとしimmutableを付けない 3. thumbnail cacheをサービス化し、availableParallelism基準のFIFO semaphoreで異なるkeyのSharp変換数を制限する。同一key single-flight、失敗時slot解放、元エラー保持、一時ファイルcleanupを保証する 4. fixtureもETag/304/空bodyのHTTP契約を実装する 5. representation差・mtime変更・条件ヘッダ優先順位・304未生成、同時実行上限・FIFO・失敗後再試行・tmp cleanupをテストする 6. pnpm check、pnpm test、cover表示と条件付きGETのブラウザ確認を別検証担当で行う
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-23: TASK-58完了後にCodexマルチエージェント運用で着手。TASK-70の配布判断と現行single-flightを確認し、HTTP cacheとSharp並列制御を独立調査する。

CoverDescriptorで軽量preflightとmaterializeを分離し、realは必要3列の1クエリ+source statでvalidatorを計算する。weak ETagはworkId/normalized width/source size/mtimeMs、Last-Modifiedはsource mtime、Cache-Controlはprivate,max-age=0,must-revalidate。INMをIMSより優先し、304ではSharp/streamへ進まない。ThumbnailCacheはavailableParallelism基準のFIFO semaphoreとservice-local single-flightを備え、sync/async/rename失敗でもslot/inFlight/tmpをcleanupして再試行可能。cache keyとGCは共通helperを使用。\n\n検証: pnpm check成功。TASK-63関連36件、server 249件、client 298件成功。agent-browserでcover6件のlazy表示、w=128の200+ETag/Last-Modified/non-immutable、同ETagの304/body 0、originalとのETag差、console/page errorなしを確認。
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): HTTP条件付きGET/キャッシュは継続でOK。Sharp並列制御はTASK-70(配布スパイク)のsharp継続/置換判断と連動するため、判断確定後の実装推奨。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
安定したカバーURLにETag/Last-Modifiedによる条件付きGETを実装し、304をサムネイル生成前に返す軽量経路へ変更した。Sharp変換をFIFOでCPU並列数以下に制限し、single-flight・失敗cleanup・GC整合をテストした。
<!-- SECTION:FINAL_SUMMARY:END -->
