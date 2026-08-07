---
id: TASK-225
title: AGENTS.mdをスリム化する（重複削除・タスク運用ルール集約・長文行の推敲）
status: Done
assignee: []
created_date: '2026-08-07 07:58'
updated_date: '2026-08-07 08:05'
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
docs/issues凍結行を削除（docs/README.mdが正）、「注意事項」を「ドキュメント運用」へ改名、タスク運用3項目（backlog一元化・タスク化基準とドラフト運用・AC7項目上限）をタスク管理節のマーカーブロック外へ集約。AC7項目行はbacklog agents --update-instructionsの実測でマーカー内が標準テンプレートに丸ごと上書きされると確認したため外出しした。長文3行を意味保持で推敲し、別セッション書き戻しでtest:visualへ巻き戻った行をtest:smokeへ復元。Sonnetレビューで指摘1件（例示の欠落）を差し戻し修正済み。pnpm check全緑。
<!-- SECTION:FINAL_SUMMARY:END -->
