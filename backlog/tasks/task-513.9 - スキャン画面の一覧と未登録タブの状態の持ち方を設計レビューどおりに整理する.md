---
id: TASK-513.9
title: スキャン画面の一覧と未登録タブの状態の持ち方を設計レビューどおりに整理する
status: Done
assignee: []
created_date: '2026-11-21 10:34'
updated_date: '2026-11-21 14:45'
labels: []
dependencies: []
parent_task_id: TASK-513
priority: high
ordinal: 598000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
マージ前の設計レビュー（Fable・Codex、scratchpad review-arch-fable.md / review-arch-codex.md）の指摘のうち、4タブの一覧状態・ツールバー配置・未登録タブの責務に関するものを直す。同じ事実を2か所で持つ形やeffect/refでの同期をなくし、バグを誘発しにくい構成にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ツールバーと絞り込みチップ行は一覧状態の部品の外に1か所だけ置き、一覧状態の部品の見出しは列見出しだけを受ける
- [x] #2 4タブの一覧状態の持ち主とpropsの形をそろえ、新規作品・更新済みの状態とretryの導出を1か所にする。状態欄の購読をサイドバーへ下ろし、要対応の行を1描画で1回だけ作る
- [x] #3 新規作品・更新済みの次ページ取得の失敗を初回の失敗と分けて扱い、自動取得を止め、取得済みの行を残したまま末尾から再試行できる
- [x] #4 更新済みの絞り込みを切り替えたとき、選んだ種類と違う条件の行を表示しない
- [x] #5 未登録のRJコード編集を行ごとに扱い、保存の応答が別の行の編集を閉じない。編集はhookに切り出し、最新値のrefは1つの流儀にそろえる
- [x] #6 絞り込みのリセットをeffectでなく派生で行い、除外済みの取得失敗を0件と区別して再試行できる。追加後の移動は再取得した候補の結果で決める
- [x] #7 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計レビュー（Fable・Codex）の指摘を反映。最終レビュー（Fable）を通して feat/scan-redesign 経由で master に --no-ff マージ（6fb8428d）。
<!-- SECTION:NOTES:END -->
