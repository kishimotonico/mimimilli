---
id: TASK-338
title: DataAdapterの業務規則をfixture/real共通のapplication serviceへ移す
status: To Do
assignee: []
created_date: '2026-08-14 10:27'
labels: []
dependencies: []
priority: low
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0018で今回のtransport統一の対象外とした、fixture/real両adapterの業務規則重複を解消する。現状の重複例:

- resume検証: InvalidResumeErrorのthrow条件がadapters/fixture/works.tsとadapters/real/userWorkStateRepository.tsに同一メッセージで二重実装
- DLsite適用: tags/title/urlのパッチ構築がadapters/fixture/dlsiteMethods.tsとadapters/real/dlsiteApply.tsで別実装（dedupeTagsの組み立てがほぼ同一）
- 作品登録: descendants_require_mergeなどの重複チェックがfixture works.tsとreal workRegister.tsで別実装

共通化可能な規則をapplication service（またはshared/core）へ移し、adapterは保存・取得の低水準portに専念させる。applyDlsiteStatePatchのようにshared側へ切り出し済みの部分はその形を踏襲する。検索・分類軸集計のcore純粋関数版とSQL版は性能上必要な二実装なので統合しない（契約テストで同値性を維持）。

参照: docs/adr/0018-vite-client-bun-server-separation.md、server/src/adapter/index.ts、server/tests/real/worksQueryContract.test.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 resume検証の条件とエラーメッセージが単一実装になり、fixture/real両adapterがそれを利用する
- [ ] #2 DLsite適用のパッチ構築（tags/title/url）が単一実装になる
- [ ] #3 作品登録の重複・マージ要求チェックが単一実装になる
- [ ] #4 既存のserverテストと契約テストが全てパスする
<!-- AC:END -->
