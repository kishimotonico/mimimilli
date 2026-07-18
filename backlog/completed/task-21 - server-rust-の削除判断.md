---
id: TASK-21
title: server-rust/の削除判断
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 18:00'
updated_date: '2026-07-10 00:00'
labels:
  - dx
dependencies: []
references:
  - docs/BACKLOG.md
  - docs/ARCHITECTURE.md
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server-rust/ディレクトリが参照実装として退避されたまま残っている。削除するか、参照実装として維持し続けるかの判断が未了。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 server-rust/を参照実装として残す価値があるか判断する
- [x] #2 削除する場合は関連ドキュメント（ARCHITECTURE.md等）の記述も合わせて更新する
- [x] #3 残す場合はその理由と今後の扱い方をドキュメントに明記する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 移植状況の確認（scanner/db/dlsite/handlersのTS移植済みを確認） 2. 削除と判断 3. README/HANDOFF/ADR-0001とコード内参照を更新 4. git rmで削除
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
削除と判断。根拠: (1) TS server(Hono)にscanner/db/dlsite/handlers全て移植済み (2) 退避(1616598)以降リネームと一括fmt以外の変更なし (3) Git履歴で参照可能。未追跡のserver-rust/target(1.6GB)は権限外のため手動削除を依頼。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
server-rust/を削除（git rm）。README・HANDOFF・ADR-0001・server/src内の由来コメント2箇所から参照を除去。凍結済みdocs/issuesは不変更。
<!-- SECTION:FINAL_SUMMARY:END -->
