---
id: TASK-462
title: スマートフォルダーで作品検索を追加条件として適用する
status: Done
assignee: []
created_date: '2026-09-21 13:44'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0026-value-list-as-global-entry.md
ordinal: 516000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマートフォルダーの作品一覧で、表示されている作品検索 q が query に渡らない経路がある。保存ルールに AND で検索語を重ねる形で適用する。保存ルールの sort と一時的な sort の関係も同じ問題であり、効かない指定を効いているように表示しない。分類値一覧を全作品への独立入口にする決定（ADR-0026）ではこの問題は解決しないため、別タスクとして担当を分ける。保存ルールの OR・除外の表現力は維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スマートフォルダーの作品一覧で、入力された作品検索qが保存ルールにANDで適用される
- [x] #2 表示されているqと実際に適用されている条件が一致する
- [x] #3 保存ルールのsortと一時的なsortのどちらが効いているかが画面から分かる
- [x] #4 効かない指定が効いているように表示されない
- [x] #5 保存ルールのOR・除外の表現力が維持されている
- [x] #6 URLから復元した状態でも入力欄・一覧・件数が同じ条件を表す
<!-- AC:END -->
