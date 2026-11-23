---
id: TASK-517.3
title: 読めないスマートフォルダーの行を正常系から外す
status: Done
assignee: []
created_date: '2026-11-23 12:49'
updated_date: '2026-11-23 13:29'
labels:
  - server
  - shared
  - client
dependencies:
  - TASK-517.1
parent_task_id: TASK-517
priority: medium
ordinal: 626000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
保存は検証済み API だけが行うので、読み出しも保存と同じスキーマ1本で厳密に読む。読めない行は一覧の正常な状態として持ち回らず、行の ID・読めない理由・直し方（実際に開いている DB のパスを入れた sqlite3 の DELETE）を示して失敗させる。BrokenSmartFolder・condition の nullable・kind:"broken"・BrokenFolderPane・reportedBrokenFolders・requireQueryable の 409 をなくす。エラー文言には総称「スマートフォルダー」を出さない（ADR-0041）。design-system.md の壊れた行の記述（225行付近）も直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SmartFolder の condition が nullable でなく、読み出し用と保存用のスキーマが1本になっている
- [x] #2 DB に読めない行があるとき、一覧とその行を引く口は 500 を返し、応答とログに行の ID・読めない理由・実際の DB のパスを入れた DELETE のコマンドが出る
- [x] #3 画面は一覧の取得失敗として、サーバーの文言（行の ID と直し方）を出す
- [x] #4 client・server・shared に壊れた行専用の画面・型・分岐（409、警告の重複抑止を含む）が残っていない
- [x] #5 新しいエラー文言に「スマートフォルダー」が出ない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
1c8c0f0e・8c20f47d・cac55ccf・7e5539a5。常駐レビュー（important 3・nit 4）を反映し再レビューで問題なし。読めない行の文言の「消した『すべて』は次の起動で戻ります」と、読み出しでの「すべて」の規則の検証は 517.2 へ引き継いだ（517.2 のメモ）。
<!-- SECTION:NOTES:END -->
