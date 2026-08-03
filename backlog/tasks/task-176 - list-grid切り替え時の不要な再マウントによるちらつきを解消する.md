---
id: TASK-176
title: list/grid切り替え時の不要な再マウントによるちらつきを解消する
status: To Do
assignee: []
created_date: '2026-08-03 04:31'
labels: []
dependencies: []
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリのビュー切り替え（list⇄grid）で一瞬空白が出る。データ再フェッチは無関係（表示モードは queryKey に含まれない）で、LibraryView.tsx:215 で WorkGrid と ContentColumn を丸ごと入れ替えるため、子ツリー（virtualizer・ResizeObserver・containerWidth state）が毎回リセットされるのが原因。特に WorkGrid.tsx:134-144 の containerWidth は ResizeObserver 発火まで 0 のため、マウント直後の1フレームはタイルが並ばない。

方針: マウント交換自体は残してよいが、初回描画で空白が出ないようにする。containerWidth 初期値の同期測定（layout effect での即時測定や初期レンダリングを測定後まで遅延しない工夫）、または両コンポーネントの共通シェル化などを調査のうえ適切な手段を選ぶ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 list⇄grid 切り替え時に空白フレームや作品なし状態が視認されない（agent-browser での確認結果を記録する）
- [ ] #2 切り替えでネットワーク再フェッチが発生しないことを確認済み
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
