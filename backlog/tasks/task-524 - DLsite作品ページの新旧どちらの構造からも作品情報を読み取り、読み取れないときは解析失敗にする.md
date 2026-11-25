---
id: TASK-524
title: DLsite作品ページの新旧どちらの構造からも作品情報を読み取り、読み取れないときは解析失敗にする
status: To Do
assignee: []
created_date: '2026-11-25 17:40'
labels:
  - dlsite
  - bug
dependencies: []
priority: high
ordinal: 643000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsiteの作品ページが新しい構造（Vue。th に data-v-* 属性、div.main_genre・div.product-slider-data なし）で返るようになり、parseDlsiteHtml（server/src/adapters/real/dlsite.ts）がタイトル以外を取れなくなった。タイトルさえ取れれば ok を返すため、取得は成功扱いのまま、候補の追加・作品詳細の適用でタイトルだけ反映され、タグは空、カバーは coverUrl=null で「DLsite側にカバーなし」扱いになり通知も出ない。2026-11-26 に RJ01127138・RJ01347244 を実装の fetchDlsiteHtml で取得して確認（circle=null, cvs=[], genreTags=[], ageRating=null, coverUrl=null。og:image にはメイン画像URLあり）。
先方のA/Bテストや段階的な切り替えの可能性があるため、旧構造をやめて新構造へ移すのではなく、どちらの構造が返っても読めるようにする。項目ごとに新旧を試すと異なる構造の値が混ざるので、先に構造を判定し、構造ごとの抽出に分ける。どちらの構造とも判定できない、または読めた内容が明らかに欠けているときは黙って成功にせず parse_error にし、次の構造変化に気づけるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 旧構造のHTMLから、現行と同じ title・circle・cvs・genreTags・ageRating・coverUrl を取り出せる（既存のパーサーテストが通る）
- [ ] #2 新構造のHTMLから title・circle・cvs・genreTags・ageRating・coverUrl を取り出せる。実ページから必要部分を切り出したフィクスチャでテストする
- [ ] #3 構造を判定してから構造ごとに抽出し、新旧の値が混ざらない
- [ ] #4 どちらの構造とも判定できないとき、またはサークルとカバーがどちらも取れないときは parse_error を返し、理由がわかるメッセージを持つ
- [ ] #5 DLSITE_PARSER_VERSION を上げ、旧版で解析したキャッシュが追加・適用で使われず、取り直しで新しい解析結果になる
- [ ] #6 docs/dlsite.md の解析の記述を現在の仕様に書き換える
<!-- AC:END -->
