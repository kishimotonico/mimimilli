---
id: TASK-452
title: 作品編集の基準を正本に揃え、user状態の更新を分離する
status: To Do
assignee: []
created_date: '2026-09-21 10:48'
labels: []
dependencies: []
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 506000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「編集用読取り」「正本変更」契約を実装する。現在 getWork は catalog 由来の値に、その場で mimimilli.json から読んだ sourceRevision を載せて返すため、外部編集のあとに編集すると正本の配列が意図せず置換される（外部で追加されたタグが全置換で消える）。編集値と revision を同一の source 読取りから得る経路へ変える。あわせて WorkPatch が meta 正本のフィールドと user 状態の bookmarked を同一コマンドで受ける契約を廃止する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 編集値と sourceRevision が同一の source 読取り由来である
- [ ] #2 外部でタグが追加されたあとに編集・保存しても、外部追加分が失われない
- [ ] #3 正本を書く入口（作品編集ダイアログ・インラインタグ編集・DLsite適用preview）がすべて同じ編集用読取り契約を通る
- [ ] #4 bookmarked の更新が sourceRevision を要求しない独立したコマンドになっている
- [ ] #5 閲覧DTOが最新sourceのrevisionを合成しない。残す場合は projectedSourceRevision のように用途が違うと分かる名前になっている
- [ ] #6 正本が壊れている作品で、閲覧できることと編集できないことが区別して表示される
<!-- AC:END -->
