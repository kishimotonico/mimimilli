---
id: TASK-176
title: list/grid切り替え時の不要な再マウントによるちらつきを解消する
status: Done
assignee:
  - '@sonnet'
created_date: '2026-08-03 04:31'
updated_date: '2026-08-03 04:48'
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
- [x] #1 list⇄grid 切り替え時に空白フレームや作品なし状態が視認されない（agent-browser での確認結果を記録する）
- [x] #2 切り替えでネットワーク再フェッチが発生しないことを確認済み
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetが実装。containerWidth測定をuseLayoutEffectでの同期測定（getBoundingClientRect）に変更し、ResizeObserverは以後の追従用に残す方式。ContentColumn側は固定行高見積もりのため同種問題なしを確認。回帰テストは修正前コードで失敗することを確認済み（空振り防止）。agent-browser（--session task176）でlist⇄grid切り替え8回、空白・再フェッチなしを確認。pnpm check / pnpm test 通過を統括側でも再確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
list/grid切り替え時の空白フレームを解消。WorkGridのcontainerWidthをuseLayoutEffectで同期測定し、マウント直後の1フレームがcolumnCount=1に縮退する問題を修正。回帰テスト追加、実機で切り替え8回の無ちらつきと再フェッチなしを確認。
<!-- SECTION:FINAL_SUMMARY:END -->
