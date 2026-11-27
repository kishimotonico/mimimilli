---
id: TASK-534
title: DLsiteのカバー画像を解析結果と別に未取得状態として扱い、取り直せるようにする
status: To Do
assignee: []
created_date: '2026-11-27 17:45'
updated_date: '2026-11-27 17:46'
labels:
  - dlsite
  - bug
dependencies: []
references:
  - >-
    backlog/tasks/task-524 -
    DLsite作品ページの新旧どちらの構造からも作品情報を読み取り、読み取れないときは解析失敗にする.md
priority: high
ordinal: 658000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
解析結果に coverUrl があるのに、カバー画像がキャッシュに無いまま fetched（取得済み）扱いになり、追加した作品にカバーが付かない。実データでは解析済み69件のすべてに coverUrl があるが、画像キャッシュは0件。TASK-524（パーサー v2）の後続。登録済み作品の一括再適用は DRAFT-86。原因: (1) パーサー v1 のHTMLは coverUrl=null だったため、画像の先取り（server/src/adapters/real/dlsiteFetch.ts の prefetchCover）は何もしなかった。(2) パーサー版を2へ上げると保存済みHTMLがキャッシュから読み直される（server/src/adapters/real/dlsiteProductResolve.ts:63-68、writeParsed）。coverUrl は付くが画像は取りに行かない。(3) 画像を取りに行くのは server/src/adapters/real/dlsiteMethods.ts:68-69 の fetchProduct の中だけ。(4) スキャン候補の取得対象を決める client/src/features/scan/model/unregisteredSelection.ts:84-90 の fetchTarget は fetched 状態の行を送らない。(5) 追加・適用時は server/src/adapters/real/dlsiteCoverStaging.ts:126 で not_cached になり、ログもなくスキップする（:98）。方針: カバー画像の有無を解析結果とは別の状態として持ち、coverUrl があって画像が無い作品を「カバー未取得」として取得対象に戻す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 解析結果に coverUrl があり、カバー画像がキャッシュに無い作品は、DLsiteの取得状態が fetched ではなく、カバー未取得を表す状態になる
- [ ] #2 スキャン候補でカバー未取得の行は、強制再取得を指定しなくても取得対象に含まれる。取得すると画像がキャッシュされ、追加した作品にカバーが付く
- [ ] #3 パーサー版の違いによる読み直しは、これまでどおり通信しない
- [ ] #4 追加・適用でカバーがキャッシュに無く付けられなかったとき、そのことが結果として利用者に分かる
- [ ] #5 「v1キャッシュ（coverUrl=null）→ v2で読み直し → 取得対象になる → 画像キャッシュ → 追加でカバーが付く」を通すテストがある
- [ ] #6 pnpm check && pnpm test が通る。UIを変えた場合は pnpm test:smoke も通る
<!-- AC:END -->
