---
id: TASK-513.10
title: スキャン画面のメニュー・Escape・選択の上書き・未スキャンの判定を設計レビューどおりに整理する
status: Done
assignee: []
created_date: '2026-11-21 10:34'
updated_date: '2026-11-21 14:45'
labels: []
dependencies: []
parent_task_id: TASK-513
priority: high
ordinal: 599000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
マージ前の設計レビュー（Fable・Codex、scratchpad review-arch-fable.md / review-arch-codex.md）の指摘のうち、共有メニューとEscapeの経路、選択の上書きの有効性、サーバーの未スキャン判定、除外済みのRJコードに関するものを直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 行メニューと分割ボタンの▾が共有の項目配列を受けるメニュー部品を使い、開閉・portal・閉じてから実行を1か所で持つ
- [x] #2 開いているポップオーバーのEscapeを既定の挙動にしてフラグをなくし、所属するダイアログの範囲で処理して前面のダイアログの操作を妨げない。RegisterFieldsPopoverも同じ経路にする
- [x] #3 選択の上書きの有効性を取得結果のrevisionで判定し、常駐effectでの刈り込み（useScanSelectionPruning）をなくす
- [x] #4 サーバーで未スキャンを候補プールの有無から導き、scanCompletedがfalseなら候補が空であることを構造で保証する
- [x] #5 スキャン入口の既読の書き込みを読み取りのhookから外す。除外済みの一覧のRJコードを直した値と一致させる
- [x] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計レビュー（Fable・Codex）の指摘を反映。最終レビュー（Fable）を通して feat/scan-redesign 経由で master に --no-ff マージ（6fb8428d）。
<!-- SECTION:NOTES:END -->
