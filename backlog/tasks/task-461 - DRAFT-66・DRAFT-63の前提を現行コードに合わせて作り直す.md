---
id: TASK-461
title: DRAFT-66・DRAFT-63の前提を現行コードに合わせて作り直す
status: Done
assignee: []
created_date: '2026-09-21 10:49'
updated_date: '2026-09-23 19:18'
labels: []
dependencies: []
ordinal: 515000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビューの照合で、2つのドラフトが現行コードと合わない前提を含むことが分かった。backlog CLI にドラフトの編集コマンドはない（list/create/archive/promote/view のみ）ため、archive して修正済みの前提で作り直す。DRAFT-66: 「scannerが自動生成して復活する」という説明は、scan が未登録フォルダーを自動登録しない現行方針と合わない。DELETE は meta も削除する現行契約である。候補非表示・登録禁止・既存Workの論理除外が1つのexcludedフラグに混ざっており、対象を Work ID にするか root+path にするかも未分離。DRAFT-66 の除外の寿命は ADR-0025 系の root 再設定の決定と関係する。DRAFT-63: mode別の再適用と「TTL経過で自然に取り直される」という説明が現行コードと要再照合。通常の一括取得は applied/skipped を対象外にするため、TTL切れだけで適用済み作品が一括refresh対象になるわけではない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DRAFT-66 の前提が現行方針（scanは未登録フォルダーを自動登録しない、DELETEはmetaも削除する）に合わせて修正されている
- [x] #2 DRAFT-66 で候補非表示・登録禁止・既存Workの論理除外が別の仕様として分けて記述されている
- [x] #3 DRAFT-66 の対象が Work ID か root+path かが明示されている
- [x] #4 DRAFT-63 の mode別再適用とTTL経過の記述が現行コードと照合のうえ修正されている
- [x] #5 DRAFT-63 で「直近jobの結果を見返す」「現在の取得状態を表示する」「取得履歴を保持する」が分けて記述されている
- [x] #6 旧前提のドラフトが現行のドラフトとして残らず、後継を辿れる状態になっている
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-451（Done）が DRAFT-63 の論点に先行して結論を出している。結果の見返しはジョブID・作品別結果・専用管理ビュー案まで具体化済み、一括refreshは「選択作品から始め、全作品の定期refreshは必須にしない」方向。「TTL切れで自然に取り直される」が適用済み作品に当てはまらないことも TASK-451 側で確認済み。このタスクの範囲は、それらを踏まえた DRAFT-63・66 本文の作り直しに限る。DRAFT-66（missing除外フラグ・再登録ブロック）は TASK-451 が扱っていないため全面的にこのタスクの範囲。調査時点の現行コードと将来仕様を混ぜない。
<!-- SECTION:NOTES:END -->
