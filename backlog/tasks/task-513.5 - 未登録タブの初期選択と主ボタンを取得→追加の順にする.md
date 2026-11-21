---
id: TASK-513.5
title: 未登録タブの初期選択と主ボタンを取得→追加の順にする
status: Done
assignee: []
created_date: '2026-11-20 10:40'
updated_date: '2026-11-20 12:40'
labels:
  - scan
  - dlsite
  - ui
dependencies:
  - TASK-513.3
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 593000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「未登録タブは取得・追加・除外を分ける」のうち選択と主ボタン。今は全候補を初期選択し、主ボタンは常に「N件を追加」なので、DLsite取得前に1クリックで全件がフォルダー名・未連携のまま追加される（監査M2、Fableは高の最上位と評価）。取得中の候補を自動で除いて追加する規則と、ツールバー右の進捗枠をやめる（ADR-0033の該当箇所を置き換え）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 判断が要る行（取得結果が該当なし・失敗、RJコードが形式に合わない、行方不明の作品と同じRJコード）は開いた時点で選ばれず、それ以外はすべて選ばれている。取得の結果が該当なし・失敗になった行は選択から外れる
- [x] #2 フッターの主ボタンは1つで、選択にRJコードあり・未取得の行があれば「DLsiteから取得 N件」、なければ「N件を追加」。選択に取得中の行があるあいだは追加を出さない
- [x] #3 取得の進捗と中止は主ボタンの位置に出る。取得中に未取得の行を選んで取得すると実行中のジョブへ合流し、進捗の分母が増える。進捗の出入りで横位置がずれない
- [x] #4 ▾の詳細操作に「取得せずに追加」「項目を選んで追加」「選択を除外」がある
- [x] #5 追加後、未登録に行が残れば未登録に留まり、無くなれば新規作品へ移る。追加のトーストとカバーを適用できなかった警告に対象の作品名が出る（複数なら「他N件」）
- [x] #6 pnpm test:smoke の追加・取得シナリオを更新して通している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
feat/scan-redesign に着地。レビュー1周＋追加修正、check・client test・smoke全体44件pass（serverの既存フレーキー1件は別途修正）。
<!-- SECTION:NOTES:END -->
