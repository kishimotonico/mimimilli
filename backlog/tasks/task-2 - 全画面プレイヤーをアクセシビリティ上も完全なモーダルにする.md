---
id: TASK-2
title: 全画面プレイヤーをアクセシビリティ上も完全なモーダルにする
status: To Do
assignee: []
created_date: "2026-07-05 17:58"
labels:
  - ui
  - player
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

全画面プレイヤー表示中も、アクセシビリティツリーに背面の検索欄・ナビ・作品詳細・ポップアップの要素が残っており、Tab移動で背面要素に到達しうる。見た目は全画面だが、キーボード/スクリーンリーダー上はモーダルとして機能していない。エンジン側の再生機能自体は実装済みで、UI/アクセシビリティ配線のみが残作業。BACKLOG.mdの『全画面プレイヤーのフォーカストラップ』(プレイヤーセクション)と同一課題のため統合。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 全画面プレイヤー表示中は背面のアプリ本体を inert 相当にする
- [ ] #2 aria-modal="true" と role="dialog"、または画面全体を占有するプレイヤーに適したランドマークを付与する
- [ ] #3 開いた際のフォーカス初期位置を「縮小」または主再生ボタンに移す
- [ ] #4 Tab/Shift+Tabの移動をプレイヤー内に閉じ込める（フォーカストラップ）
- [ ] #5 Escで閉じた後、開く前にフォーカスがあったボタンへフォーカスを戻す
<!-- AC:END -->
