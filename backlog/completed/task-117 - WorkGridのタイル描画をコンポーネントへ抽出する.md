---
id: TASK-117
title: WorkGridのタイル描画をコンポーネントへ抽出する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 01:58'
updated_date: '2026-08-02 16:09'
labels:
  - client
  - refactor
dependencies:
  - TASK-109.1
priority: low
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkGrid.tsx:336-424 の renderTile / renderRow が JSX を返す useCallback になっており、タイルが独立したコンポーネントになっていない。責務分離の観点で WorkTile / WorkGridRow へ抽出する。

注意点:
- 抽出するだけでは再レンダリングは減らない。未選択タイルの再描画をスキップするには memo + 安定した callback + isSelected のような狭い props が揃う必要がある
- 対象は全作品ではなく、仮想化された表示中の行 + overscan 分だけなので、性能面の効果は限定的。責務分離が主目的で、優先度は低い

WorkGrid の責務が9種類ほどに膨らんでいる（仮想スクロール2モード・レイアウト計算・無限スクロール・ctrl+wheelズーム・Inspector配置・キーボードナビ・MutationObserverでの余白調整・空/loading/error表示・タイル描画）ので、他の切り出し候補も併せて検討してよい。

なお inspector: ReactNode を props で受ける形は、WorkGrid に詳細取得・編集UIまで持たせないための設計として妥当なので変えない。分けるなら LibraryView 側に grid と inspector を配置するレイアウトコンポーネントを置く。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タイル描画が WorkTile コンポーネントとして独立している
- [x] #2 グリッドの表示・選択・ダブルクリック再生・キーボードナビが従来どおり動作する
- [x] #3 memo を付けた場合は callback と props が安定していて実際にスキップが効いている（付けない選択も可、その場合は理由をタスクに記録する）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-08-03 実装完了】WorkTile（memo付き）とWorkGridRow（memoなし）へ抽出。memoの判断: WorkTileのpropsはプリミティブ＋安定コールバック（moveTileFocusのdepsにselectedWorkId/playingWorkIdを含まない）で構成され、選択変更時はisSelectedが変わるタイルのみ再描画される。WorkGridRowは行単位でselectedWorkId等を受けるためmemoが無効化されやすく、軽量ラッパーなので付けない。DOM構造・クラス名は1:1で維持。Cursor(composer-2.5)へ委譲、統括レビュー済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkGrid.tsxのrenderTile/renderRow useCallbackを廃止し、WorkTile.tsx（memo）・WorkGridRow.tsx（justified/square両モード）へ抽出。表示・選択・ダブルクリック再生・キーボードナビ・仮想スクロールの挙動は不変。pnpm check・pnpm test全パス。
<!-- SECTION:FINAL_SUMMARY:END -->
