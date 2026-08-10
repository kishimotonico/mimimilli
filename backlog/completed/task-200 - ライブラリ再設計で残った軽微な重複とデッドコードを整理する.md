---
id: TASK-200
title: オーバーレイのdismissal二重実装と余白の二重適用を解消する
status: Done
assignee: []
created_date: '2026-08-05 10:57'
updated_date: '2026-08-05 21:25'
labels: []
dependencies: []
priority: high
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ再設計のレビューで見つかった構造上の重複・責務の不統一・デッドコードを解消する。

当初「軽微な整理」として起票したが、内容を見直したところ実害の疑いを含むものと、既に必須と判断した修正と同じ性質のものが混ざっていた。分類を改める。

## 1. useAnchoredPopover の dismissal ロジックが二重実装（最優先）

AxisQuickOverlay は共有フック useAnchoredPopover に空のコールバックを渡し、外側クリック・Escape・フォーカス復帰を独自実装している。ポータル先が別 DOM 系統になり anchor と panel の両方を境界として扱う必要がある、というのが理由。

TASK-195 では「位置決めの実装を2つ持たない」ことを理由に、同じ AxisQuickOverlay の自前位置計算を共有フックへ一本化させた。dismissal も同じ性質の重複であり、片方だけ必須としたのは判断の不整合である。

共有フック側が複数の境界要素を扱えるようにし、独自実装を解消する。

## 2. リスト末尾余白の二重適用（実害の疑いあり）

WorkListPane が MutationObserver で .mle-app の has-docked-bar を監視して仮想リストの paddingEnd を増やす（4+8=12px）一方、shell.css の .mle-app.has-docked-bar .mle-col__list にも padding-bottom: 12px がある。同一要素へ二重適用されて合計24pxになっている疑いがあるとの調査報告がある。

まず実際に二重適用されているかを確認し、二重なら片方を正にする。JS 側を残すなら CSS を削り、CSS で足りるなら MutationObserver ごと削除する。

## 3. onPatchWork の重複と到達不能な分岐

LibraryView.tsx に同じ実装の onPatchWork コールバックが2箇所ある。また selectedWork 未選択時の Promise.reject は現在の描画経路では到達不能。1つにまとめ、到達不能な分岐を削除する。

## 4. AxisColumn の props と hook の混在

軸の状態は props で受けるのに、タグの状態と操作だけ useLibraryNavigation() から直接取得している。同じコンポーネント内で契約が二系統になっており、後から読む人が依存を追えない。presentational component に寄せてタグ操作も props で注入するか、すべて hook から取得する container に寄せるか、どちらかに統一する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useAnchoredPopover が複数の境界要素（anchor と portal 先の panel）を扱えるようになり、AxisQuickOverlay の独自 dismissal 実装が解消されている
- [ ] #2 共有フックの既存利用箇所（ソートメニュー・タグエディタ・メタデータ操作・通知ベル・チップの兄弟値ドロップダウン）が壊れていない
- [ ] #3 リスト末尾余白が二重適用されているかを確認し、二重なら片方に統一されている（二重でなかった場合はその旨を記録する）
- [ ] #4 onPatchWork の重複が解消され、到達不能な分岐が削除されている
- [ ] #5 AxisColumn の状態取得方法が props か hook のどちらかに統一されている
- [ ] #6 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
