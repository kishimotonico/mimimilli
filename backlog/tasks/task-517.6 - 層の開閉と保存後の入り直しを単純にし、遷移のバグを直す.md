---
id: TASK-517.6
title: 層を履歴エントリーの状態だけに持ち、履歴同期から項目専用のオプションをなくす
status: To Do
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 15:11'
labels:
  - library
  - client
dependencies:
  - TASK-517.5
parent_task_id: TASK-517
priority: high
ordinal: 629000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
層の補正の引き継ぎ（LayerCarry・closesLayerBelow・revisitedCarry・readCarryLibrary・ParseContext.delta）、np=1 と openedBy、pushSameUrl をなくす。同期の push は URL か履歴エントリーの状態が変われば積み、同じ場所への入り直しは遷移の純粋関数が置き換えを指定する（ADR-0041）。HANDOFF.md（123行付近）と requirements-v4.md の層の記述も直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 routeStore と useRouteHistorySync が項目専用のオプション（pushSameUrl・delta）を持たない
- [ ] #2 層を開くと URL は変わらず履歴が1件増え、URL に np が無い
- [ ] #3 閉じると1件戻り、連続で閉じても2件戻らない。再生していないのに層を持つエントリーに着いたときも1件戻る
- [ ] #4 サイドバーで開いている行を押し直しても履歴が増えない
- [ ] #5 層が開いている間の補正は層のエントリーだけを書き換え、閉じた先には引き継がない（carry の型と関数が残っていない）
- [ ] #6 pnpm test:smoke の再生中の層のシナリオが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
統括（517.5 の常駐レビューから）: searchLibraryInAll（libraryRouteTransitions.ts:217 付近）は 517.5 で「値一覧・作品一覧以外は null」のガードが外れ、無条件に enter（push、並びと seed を捨てる）になった。今は「すべて」では RefinementActions がボタンを出さないので通らない経路だが、ADR-0041:159 は「すでに『すべて』にいて『すべて』で探す」を置き換えと決めている。同じ場所への入り直しを置き換えにする判断を enter() に入れるとき、この関数も対象にする。
<!-- SECTION:NOTES:END -->
