---
id: TASK-447.22
title: SmartFolderEditorModal と TagPrefixSettings から1件ぶんの UI を切り出す
status: Done
assignee: []
created_date: '2026-09-11 08:05'
updated_date: '2026-09-11 08:23'
labels:
  - refactor
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 490000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上 第3回（tmp/uiux-triage-2026-09-11/followup-3.md の4）。SmartFolderEditorModal.tsx（560行）からルール1件ぶんの UI を SmartFolderRuleCard.tsx に、TagPrefixSettings.tsx（398行）から prefix 1行ぶんを TagPrefixRow.tsx に切り出す。状態の持ち主は親のまま。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SmartFolderRuleCard がルール1件の入力（field/operator/value）・削除・未確定タグの commit ハンドルを持ち、モーダル本体は名前・ルール一覧・ライブ件数・保存/削除だけを持つ
- [x] #2 TagPrefixRow が prefix 1行（ラベル編集、色、軸/保護トグル、並び替え、削除）を持ち、新規追加フォームも別コンポーネントになっている
- [x] #3 切り出したコンポーネントの props は、その行が必要とする値と変更を親へ返すコールバックだけで、状態の持ち主は親のまま
- [x] #4 挙動は変わらず、既存テストの期待値を変えていない（テストの統合・名前変更だけ許容し、タスクメモに列挙）。pnpm check（レイヤー境界含む）・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。コミット: b13cac3（SmartFolderRuleCard切り出し）, 0e48ec1（TagPrefixRow/TagPrefixAddForm切り出し）, 0c076ee（oxfmt整形）。
テスト期待値は変更なし（smartFolderEditorModal.test.ts 16件、TagPrefixSettings.test.tsx 3件とも無修正で通過）。
pnpm check / pnpm test（1098件） / pnpm test:smoke（25件）すべて通過。
smoke初回実行で詳細パネル系4件が並列実行時のタイムアウトで失敗したが、--workers=1での単体再実行と2回目のフル実行では全て成功（WSL2既知の並列flakinessで、今回の変更とは無関係と判断）。
実機確認: fixture(new-work)でスマートフォルダー作成（未確定タグのcommit・ルール追加/削除）、prefix設定（追加/ラベル編集/色/軸・保護トグル/並び替え/削除）を一通り操作し正常動作を確認。
<!-- SECTION:NOTES:END -->
