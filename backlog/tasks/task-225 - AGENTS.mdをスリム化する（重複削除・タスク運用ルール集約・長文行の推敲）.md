---
id: TASK-225
title: AGENTS.mdをスリム化する（重複削除・タスク運用ルール集約・長文行の推敲）
status: To Do
assignee: []
created_date: '2026-08-07 07:58'
updated_date: '2026-08-07 08:03'
labels: []
dependencies: []
priority: medium
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
overlap-scan調査（2026-08-07）に基づく整理。docs側に正がある重複行の削除、2箇所に割れたタスク運用ルールの集約、長文行の推敲を行う。あわせて別セッションの書き戻しでtest:visualへ巻き戻った検証運用の行をtest:smokeの現行文言へ再修正する。BACKLOG.MD GUILDELINESマーカー内はbacklog agentsコマンドの自動管理の可能性があるため、編集前に裏取りし、プロジェクト固有ルールはマーカー外へ置く。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/issues凍結の行が削除されている（docs/README.md:24が正）
- [x] #2 「注意事項」が「ドキュメント運用」へ改名され、docs・ADR・メンテナンスドキュメントの項目だけが残っている
- [x] #3 タスク運用ルール3件（backlog一元化・ドラフト運用・AC7項目上限）がタスク管理節へ集約され、自動管理マーカーの外に配置されている
- [x] #4 検証運用のブラウザテスト行がtest:smokeの現行文言に戻っている
- [x] #5 長文行の推敲で意味・固有ルールが失われていない（削除は重複4行のみ）
- [x] #6 pnpm checkが通る
<!-- AC:END -->
