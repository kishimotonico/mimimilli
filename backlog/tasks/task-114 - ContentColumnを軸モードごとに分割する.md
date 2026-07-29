---
id: TASK-114
title: ContentColumnを軸モードごとに分割する
status: To Do
assignee: []
created_date: '2026-07-27 01:57'
labels:
  - client
  - refactor
dependencies: []
priority: medium
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ContentColumn.tsx（338行 / 21 props）が、タグ軸UI・ファセット軸UI・作品一覧という排他的な3モードを1ファイルに抱えている。軸ごとに使われない props が混在しており、インターフェース分離の観点で分けるべき。

加えて、作品一覧用の useVirtualizer が早期 return より前（ContentColumn.tsx:81 付近）にあるため、タグ・ファセット表示でも毎回生成されている。

方針:
- タグ / ファセット / 作品一覧を別コンポーネントに分ける。必ずしも3ファイルに分割する必要はなく、内部コンポーネント + 判別可能ユニオンでもよい
- virtualizer は作品一覧のコンポーネントだけが持つ
- タグ・ファセットの一覧が非仮想化の全件 map になっている点は、件数の実測を踏まえて別途判断する（このタスクでは仮想化しない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 タグ軸・ファセット軸・作品一覧が別コンポーネントに分かれ、各コンポーネントが自分のモードで使う props だけを受け取る
- [ ] #2 タグ軸・ファセット軸の表示時に作品一覧用の virtualizer が生成されない
- [ ] #3 3モードそれぞれの表示・選択・ドリルダウン・追加読み込みが従来どおり動作する
<!-- AC:END -->
