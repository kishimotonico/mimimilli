---
id: TASK-492
title: 作品編集ダイアログの編集状態をフックへ切り出し、RJコード入力中に閉じたときの確認を決める
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
labels:
  - client
  - refactor
dependencies:
  - TASK-445
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 550000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkEditDialog.tsx は587行でuseStateが13個あり、スナップショット取り込み・競合解決の状態機械、保存処理、タイトル・タグ・URLの3フィールドのフォームを1コンポーネントに持つ。URL検証エラーの解除が3箇所に重複している。isDirtyはtitle/tags/urlsだけを見ており、DlsiteEditor が内部stateで持つRJコードを入力中に閉じても未保存の確認が出ない。STATUS_LABEL のようにダイアログ間で共有している表示定義もある。編集状態（取り込み・reconcile・競合・dirty・保存）をreducerと純関数のフックにしてテストできるようにし、URL行は別コンポーネントにする。RJコードについては、DRAFT-47・TASK-456で合意した「コードの確定は取得操作に統合する」方向に沿って、閉じたときの扱いを決めて実装する。タグ編集の保存モデル見直しはDRAFT-47の結論待ちで対象外。保存失敗テストのフレーク（TASK-445）を先に片付ける。詳細は doc-7 の cli-ui-4。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 編集状態の取り込み・競合・dirty判定・保存が、Reactを使わない単体テストで縛られている
- [ ] #2 RJコードの入力途中でダイアログを閉じたときの挙動が決まっていて、入力が黙って失われない
- [ ] #3 ダイアログ間で共有する表示定義がentities側にある
- [ ] #4 WorkEditDialogのコンポーネントにフォーム描画以外の状態管理が残っていない
- [ ] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
