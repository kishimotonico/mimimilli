---
id: TASK-102
title: DLsiteのパース失敗・取得失敗の増加を検知できるようにする
status: Done
assignee: []
created_date: '2026-07-26 05:14'
updated_date: '2026-07-26 09:28'
labels: []
dependencies: []
documentation:
  - docs/dlsite.md
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite側のHTML構造が変わると parseDlsiteHtml が壊れるが、現状それに気づく手段が通知ベルのバッジ（GET /dlsite/notifications の fetch-failed 件数）しかない。parse_error は dlsite_fetch_failures とは別に dlsite_html_snapshots の outcome=parse_error として1時間TTLで記録されているだけで、件数の増加を運用者へ能動的に知らせる仕組みがない。

セレクタの正典は server/tests/real/dlsite.test.ts のフィクスチャテストなので、DLsite側の変更はテストでは検知できない（テストは固定HTMLを使うため）。実運用でパース失敗が急増したときに気づけることが目的。

TASK-44で実装した通知ベルセンターの上に載せる形を想定。監視基盤を持ち込むのではなく、既存の通知UIと GET /dlsite/notifications の拡張で完結させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /dlsite/notifications が parse_error の件数を fetch-failed とは区別して返す
- [ ] #2 一括取得の実行結果に、その回で発生した parse_error 件数が含まれる
- [ ] #3 parse_error が一定件数・一定割合を超えた場合に、通常の取得失敗とは区別した警告として通知センターへ表示される
- [ ] #4 警告からパース失敗した作品のRJコードを特定でき、キャッシュ済みHTMLを使って原因調査に進める導線がある
- [ ] #5 しきい値判定のロジックにテストがある
<!-- AC:END -->
