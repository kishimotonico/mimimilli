---
id: TASK-517
title: client のテストコードを型検査の対象に入れる
status: To Do
assignee: []
created_date: '2026-11-22 19:18'
labels:
  - test
  - client
dependencies: []
priority: medium
ordinal: 618000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client の tsc は src だけを見ていて、client/tests は型検査されていない。TASK-516.16 のレビューで、シグネチャ変更に追随していないテスト（文字列を view として渡したまま意図しない分岐を通って成功）が見つかった。2026-11-23 の計測で tests を含めると 536 エラー・86 ファイル（vitest/globals の型未解決が約67、Work のテスト用ファクトリが必須フィールドに追随していないものが多い。多いファイルは playerController.test.ts・useMediaSession.test.ts・UnregisteredTab.test.tsx・usePlayer.test.ts）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm check の型検査が client/tests を含み、エラー 0 で通る
- [ ] #2 テスト用の Work などのファクトリが本番の型から作られ、必須フィールドの追加でテストが型エラーになる
- [ ] #3 型を合わせるために期待値を削除・緩和していない（テストの書き換えは型の修正に限る）
<!-- AC:END -->
