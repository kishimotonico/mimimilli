---
id: TASK-118
title: レビューで見つかったアクセシビリティ不備をまとめて解消する
status: To Do
assignee: []
created_date: '2026-07-27 01:58'
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
- [ ] #1 シークバーがキーボード（矢印キー）で操作でき、role と aria-valuenow が付いている（バー・ポップアップ・フルスクリーンで共通）
- [ ] #2 タグ行の選択状態が支援技術に伝わる
- [ ] #3 タグ解除ボタンと SettingsModal の閉じるボタンに accessible name がある
- [ ] #4 WorkGrid のタイルのラベルと実際の操作（選択・再生）が一致している
- [ ] #5 FullScreenPlayer のトラックリストが安定した key を使っている
<!-- AC:END -->
