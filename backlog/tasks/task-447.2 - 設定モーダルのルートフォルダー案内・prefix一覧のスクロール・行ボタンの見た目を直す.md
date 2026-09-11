---
id: TASK-447.2
title: 設定モーダルのルートフォルダー案内・prefix一覧のスクロール・行ボタンの見た目を直す
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
updated_date: '2026-09-11 01:51'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 470000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち設定モーダルに関わる 428.6・428.9・428.21 をまとめて直す。ユーザー理由: 428.6「メッセージは簡素でいい」、428.9「prefixタグの個数はユーザーで大きく変わるので、件数に応じて適切にスクロールできるように」、428.21「ゴミ箱→バツ、丸ボタンの間引き」（原因は TagPrefixSettings.tsx のアイコン選択と IconButton 多用。tmp/uiux-triage-2026-09-11/button-impact.md）。Button.tsx の variant/size 定義は変更しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ルートフォルダー変更後の案内が1文（例:「再スキャンすると新しいフォルダーの内容になります」）に短縮され、保存中の「保存中...」表示は残っている
- [ ] #2 prefix を30件程度にした fixture で、全行とフッター操作に到達でき、スクロール領域が入れ子にならず、header/footer は固定表示のまま。着手前に現状のスクショ付きで挙動を統括へ報告し、仕様の確認を受けてから実装している
- [ ] #3 TagPrefixSettings の行の削除アイコンがゴミ箱からバツ（I.x）に戻っている
- [ ] #4 行ごとの上移動・下移動・削除の3ボタンが常時表示のまま、master の削除ボタン（22px・角丸4px・塗りと枠なし）と同じ視覚的な重さに揃っている。実装前に fixture のスクショ1枚を統括経由でユーザー確認に回している
- [ ] #5 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.2-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.2-after.jpg に置き、タスクメモから参照している
- [ ] #6 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: 案内文を「再スキャンすると新しいフォルダーの内容になります。」に短縮（保存中表示は維持）。既存テストなし。AC2はfixtureで30件検証済み、AC3/4は視覚提案のスクショ作成済み。統括へ報告し確認待ち。

pnpm check: 全通過（exit 0）。関連unit test（settingsModal.test.ts, TagPrefixSettings.test.tsx）19件全通過。settingsModal.test.tsのSTALE_NOTICE_TEXTを新文言「再スキャンすると新しいフォルダーの内容になります。」に更新済み。AC3/4試作（I.trash→I.x、text-ink-3付与）はworktreeにそのまま保持、ユーザー確認待ち。
<!-- SECTION:NOTES:END -->
