---
id: TASK-200
title: ライブラリ再設計で残った軽微な重複とデッドコードを整理する
status: To Do
assignee: []
created_date: '2026-08-05 10:57'
labels: []
dependencies: []
priority: medium
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex による2回目のマージ前レビュー（2026-08-05）の改善推奨。いずれも動作に影響しない整理で、マージのブロッカーではない。

## 1. onPatchWork の重複と到達不能な分岐（LibraryView.tsx）

同じ実装の onPatchWork コールバックが2箇所（198行目付近と330行目付近）にある。また selectedWork 未選択時の Promise.reject は、現在の描画経路では到達不能。1つにまとめ、到達不能な分岐を削除する。

## 2. リスト末尾余白の二重実装（WorkListPane.tsx / shell.css）

WorkListPane が MutationObserver で .mle-app の has-docked-bar クラスを監視して仮想リストの paddingEnd を増やす一方、shell.css の .mle-app.has-docked-bar .mle-col__list にも padding-bottom が入っている。同じ目的の余白が JS と CSS の2箇所にある。

まず本当に二重適用になっているか（対象要素が同一か）を確認し、二重なら片方を正にする。JS 側を残すなら CSS を削り、CSS 側で足りるなら MutationObserver ごと削除するのが望ましい。

## 3. AxisColumn の props と hook の混在（AxisColumn.tsx）

軸の状態は props で受けるのに、タグの状態と操作だけ useLibraryNavigation() から直接取得している。presentational component に寄せてタグ操作も props で注入するか、すべて hook から取得する container に寄せるか、どちらかに統一する。

## 4. useAnchoredPopover が複数境界を扱えない（AxisQuickOverlay.tsx）

AxisQuickOverlay は共通フックに空のコールバックを渡し、外側クリック・Escape・フォーカス復帰を独自実装している。ポータル先が別 DOM 系統になるため anchor と panel の両方を境界として扱う必要があり、独自実装自体には正当な理由がある。ただし共通フック側が複数境界を扱えるようにすれば、この独自実装は不要になり保守しやすくなる。

TASK-195 で位置決めを共有フックへ一本化したのと同じ方向の整理である。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 onPatchWork の重複が解消され、到達不能な分岐が削除されている
- [ ] #2 リスト末尾余白の実装が JS か CSS のどちらか一方に統一されている（二重でなかった場合はその旨を記録する）
- [ ] #3 AxisColumn の状態取得方法が props か hook のどちらかに統一されている
- [ ] #4 useAnchoredPopover が複数の境界要素を扱えるようになり、AxisQuickOverlay の独自実装が不要になっている
- [ ] #5 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
