---
id: TASK-466
title: ナビゲーション状態を型付きAppRouteへ一本化する
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - refactor
  - architecture
  - navigation
dependencies: []
priority: medium
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/architecture-review-2026-09-20.md R4。8月のapplication-architecture-review-2026-08-12.mdからの再掲で、2回のレビューをまたいで未着手。

現在のコード根拠:
- client/src/features/navigation/model/useNavigationHistory.ts（購読とsetter群、URLからの適用、URL再構成）
- client/src/shared/model/navigationHistoryAtoms.ts
- client/src/entities/library/model/navigationActions.ts

画面mode、Libraryの軸・選択・検索、Filesの場所・選択、作品詳細IDが別々のatomへ置かれ、push/replaceの要求も別atomへ置かれている。useNavigationHistoryが全体を購読し、URLから個々のatomへ書き戻し、別のeffectでatom群からURLを再構成している。

決定事項（統括判断、新しいADRに記録する）:
- 型付きのAppRouteを一つの正本とし、navigate(route, { replace })とブラウザー履歴からの適用で更新する。
- Jotaiは廃止せず、一つのroute atomと派生atomで構成してよい。
- 表示密度・popoverなどURLと無関係な状態はAppRouteと分けたままにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRでAppRouteの型設計・navigate(route, { replace })契約・派生atomの分け方を記録している
- [ ] #2 画面mode・Libraryの軸/選択/検索・Filesの場所/選択・作品詳細IDがAppRoute型による一つの正本から導出される
- [ ] #3 navigate(route, { replace })とブラウザー履歴からの適用のみがroute更新経路になり、useNavigationHistoryの個別setter群が無くなっている
- [ ] #4 表示密度・popoverなどURLと無関係な状態は従来通りAppRouteと分離されている
- [ ] #5 新しいroute項目を1つ追加する変更がAppRoute型定義とparse/serializeの追加だけで完結し、購読・適用・再構成の既存コードを変更せずに済むことをテストまたは実装例で示す
- [ ] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
