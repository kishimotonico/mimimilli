---
id: TASK-118
title: レビューで見つかったアクセシビリティ不備をまとめて解消する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-27 01:58'
updated_date: '2026-07-31 02:03'
labels:
  - client
  - a11y
dependencies: []
priority: medium
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で見つかった a11y の不備。個別に小さいのでまとめて扱う。

- シークバーがキーボードで操作できない。role="slider" / aria-valuenow / 矢印キーがない。FullScreenPlayer.tsx:134-144 だけでなく、同じ useSeekDrag を使う再生バー・ポップアップにも共通する。共通化して直す
- ContentColumn.tsx:185 付近のタグ行は button なので、role="checkbox" を付けるより aria-pressed を付けるか本物の checkbox にするのが自然
- ContentColumn.tsx:163 付近の選択済みタグの解除ボタンに accessible name がない
- SettingsModal.tsx:115 の閉じるボタンに accessible name がない
- WorkGrid.tsx:354-363 は aria-label が「〜を選択」なのに Enter で再生される。ラベルと操作が一致していない（ラベルを直すか操作を見直す）
- FullScreenPlayer.tsx:315 のトラックリストが key={i}。t.id が使えるので直す（他の index key ——アドレスバーのパンくず・SVG path・スマートフォルダーのルール —— は index が実質的な identity なので対象外）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 シークバーがキーボード（矢印キー）で操作でき、role と aria-valuenow が付いている（バー・ポップアップ・フルスクリーンで共通）
- [x] #2 タグ行の選択状態が支援技術に伝わる
- [x] #3 タグ解除ボタンと SettingsModal の閉じるボタンに accessible name がある
- [x] #4 WorkGrid のタイルのラベルと実際の操作（選択・再生）が一致している
- [x] #5 FullScreenPlayer のトラックリストが安定した key を使っている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. シークバーのslider role+キーボード操作（useSeekDrag共通化）
2. タグ行aria-pressed・各closeボタンのaccessible name・WorkGridラベル整合・key修正
実装Cursor委譲
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-07-30 の棚卸しで確認した現存箇所】

AC に挙がっている項目はすべて master に現存することをコードで確認済み。

- シークバー: FullScreenPlayer.tsx:134-159 は onPointerDown/Move/Up のみで role="slider" / aria-valuenow / onKeyDown なし。useSeekDrag は PopupContent.tsx / BarContent.tsx / FullScreenPlayer.tsx の3箇所で共有されているので、共通化して直す
- タグ行: ContentColumn.tsx:186-199 の button に aria-pressed / role="checkbox" なし
- タグ解除ボタン: ContentColumn.tsx:168 の button はアイコンのみで accessible name なし
- SettingsModal 閉じるボタン: SettingsModal.tsx:109-124 はアイコンのみで aria-label なし
- WorkGrid: WorkGrid.tsx:350 の aria-label は「〜を選択」だが、onKeyDown の Enter（356-359行）は onWorkPlay を呼ぶ
- FullScreenPlayer トラックリスト: FullScreenPlayer.tsx:315 が key={i}

【AC #4（WorkGrid）は実装前に期待動作を決めること】

ラベルを「再生」に変えるだけでは、今度はクリック（選択）と食い違う。現状はクリック=選択、Enter=再生。Enter を click と同じ「選択」に揃えたうえで、キーボードからの再生手段を別に定義するのが自然だが、いずれにせよ click / Space / Enter / double click それぞれの期待動作を決めてから実装すること。

また client/tests/unit/WorkGrid.test.tsx が name: /を選択/ でタイルを取得している（100, 112, 122, 175 行）。ラベルを変更する場合はテストの同時更新が必要。

【AC #5（key={i}）の位置づけ】

これは a11y の不備ではなく React の要素同一性に関する品質問題。本タスクに含めたままでよいが、タスク名が「アクセシビリティ不備」なので厳密には範囲外。並べ替えや増減で実害を再現できないなら、切り出して別タスクにする判断もありうる。

【回帰テスト】

各修正には回帰テストを付けること。特に WorkGrid は既存テストが現在のラベルを明示的に期待しているため、操作仕様とテストを同時に更新する必要がある。

useSeekDragにsliderProps（WAI-ARIA sliderパターン、±5秒/Home/End）を集約し3シークバーへ適用。Codexレビュー1件（グローバルショートカットとの二重シーク）はstopPropagationで対応、二重シーク防止テスト追加。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
シークバーのキーボード操作+ARIA、タグ行aria-pressed、accessible name×2、WorkGridラベル整合、key安定化。server 385/client 448テスト・ビジュアル6/6・pnpm check通過。実装Cursor委譲、Codexレビュー1件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
