---
id: TASK-63
title: サムネイル配信のHTTPキャッシュとSharp並列数制限
status: To Do
assignee: []
created_date: '2026-07-19 02:03'
updated_date: '2026-07-19 04:07'
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
- [ ] #1 サムネイル・カバー配信が条件付きGET（304）またはimmutableキャッシュで再取得を回避できる
- [ ] #2 サムネイル生成の同時実行数が制限される
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): HTTP条件付きGET/キャッシュは継続でOK。Sharp並列制御はTASK-70(配布スパイク)のsharp継続/置換判断と連動するため、判断確定後の実装推奨。
---
<!-- COMMENTS:END -->
