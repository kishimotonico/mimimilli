---
id: TASK-516.4
title: AppRoute に履歴エントリーの状態を持たせ、route 同期で読み戻す
status: To Do
assignee: []
created_date: '2026-11-21 20:23'
labels:
  - library
  - navigation
dependencies:
  - TASK-516.1
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
  - docs/adr/0031-app-route-navigation.md
parent_task_id: TASK-516
priority: high
ordinal: 605000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041「履歴エントリーごとの状態」の土台。sort が URL から消えるので、クライアントのデータ層を替える前に入れる。AppRoute.library に sort（今の並び、null なら既定）と seed を、layer に開き方を持たせ、codec が「URL に出す部分」と「履歴エントリーの状態に書く部分」に分ける。route 同期（useRouteHistorySync）は項目名を知らない汎用のまま、navigate のオプションで状態を書き、popstate と初回ロードで読み戻す。今の randomSeedAtom はここで library.seed に移す。層そのものの実装は後の段。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 codec が AppRoute を URL と履歴エントリーの状態に分けて書き、両方から同じ AppRoute を読み戻す（往復の単体テストがある）
- [ ] #2 戻る・進む・再読み込みで、URL に出ない今の並びと seed が元のエントリーの値に戻る
- [ ] #3 URL を直接開いて履歴エントリーの状態が無いとき、クライアントが seed を作り置き換えで書く
- [ ] #4 route 同期のコードが sort・seed・layer の項目名を参照しない
- [ ] #5 randomSeedAtom がなくなり、ランダムの seed は library.seed だけにある
<!-- AC:END -->
