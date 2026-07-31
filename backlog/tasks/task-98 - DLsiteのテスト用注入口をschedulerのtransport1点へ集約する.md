---
id: TASK-98
title: DLsiteのテスト用注入口をschedulerのtransport1点へ集約する
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-25 23:34'
updated_date: '2026-07-31 02:04'
labels: []
dependencies: []
priority: medium
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

`RealAdapterOptions` にDLsite用のテスト注入口が6個ある。

- `dlsiteFetcher`
- `dlsiteHtmlFetcher`
- `dlsiteParser`
- `dlsiteCoverFetcher`
- `dlsiteCoverDownloader`
- `dlsiteRequestIntervalMs`（`@deprecated` 明記済み）

いずれも `server/tests/real/dlsite.test.ts` 1ファイルからしか渡されておらず、本番起動コード（`server/src/index.ts`）は一切渡さない。

そのせいで本番コードに次の分岐が生えている。

- `options.dlsiteFetcher ? (rj) => schedule(...) : dlsiteFetcher` のように「注入されていたらschedulerで包み直す」三項演算子が3組
- `!dlsiteCache` のときキャッシュを使わず生fetcherへ直行するフォールバック経路。本番は必ず `dlsiteCache` を渡すため**絶対に通らない死コード**

## やること

HTTPレイヤー1点、つまり `DlsiteScheduler` の `transport` 注入だけでテストが書けるようにし、上記6個のオプションと関連する分岐を削除する。

- `!dlsiteCache` のフォールバック経路を削除し、キャッシュを必須にする
- 「注入されていたら包み直す」三項演算子を削除する
- `dlsite.test.ts` を transport 注入ベースへ書き換える

失うのは「fetch / parse / cover取得を個別に差し替えられるテストの粒度」。`transport` 注入とキャッシュのfake経路の組み合わせで代替できる見込みだが、書き換えの過程で表現しづらいケースが出たら、その分だけ注入口を残す判断でよい。残す場合は理由をコード外（タスクの実装メモ）に記録すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 RealAdapterOptions からDLsite用のテスト注入口が削除され、残った場合は理由が実装メモに記録されている
- [ ] #2 dlsiteCache を渡さない場合のフォールバック経路が削除され、キャッシュが必須になっている
- [ ] #3 「注入されていたらschedulerで包み直す」三項演算子が解消されている
- [ ] #4 dlsite.test.ts が scheduler の transport 注入ベースで書かれ、実ネットワークへアクセスしない
- [ ] #5 既存のDLsite関連テストのカバレッジが実質的に落ちていない（検証していた挙動が引き続き検証されている）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DlsiteScheduler transport注入1点化、6注入口と死コード分岐の削除
2. dlsiteCache必須化
3. dlsite.test.tsのtransportベース書き換え
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->
