---
id: TASK-492
title: 作品編集ダイアログの編集状態をフックへ切り出す
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
updated_date: '2026-10-04 09:35'
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
WorkEditDialog.tsx は587行でuseStateが13個あり、スナップショット取り込み・競合解決の状態機械、保存処理、タイトル・タグ・URLの3フィールドのフォームを1コンポーネントに持つ。URL検証エラーの解除が3箇所に重複している。STATUS_LABEL のようにダイアログ間で共有している表示定義もある。TASK-456で確定した一括draft保存（title/tags/urls）の契約のまま、編集状態（取り込み・reconcile・競合・dirty・保存）をreducerと純関数のフックにしてテストできるようにし、URL行は別コンポーネントにする。DlsiteEditor が内部stateで持つRJコードを入力中に閉じても未保存の確認が出ない点は、DRAFT-47で扱う「コードの確定を取得操作に統合する」方向の未決事項（取得失敗時の扱いなど）に含まれるため、このタスクでは扱わない。保存失敗テストのフレーク（TASK-445）を先に片付ける。詳細は doc-7 の cli-ui-4。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 編集状態の取り込み・競合・dirty判定・保存が、Reactを使わない単体テストで縛られている
- [ ] #2 ダイアログ間で共有する表示定義がentities側にある
- [ ] #3 WorkEditDialogのコンポーネントにフォーム描画以外の状態管理が残っていない
- [ ] #4 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: RJコード入力中に閉じたときの挙動は仕様が決まっていないのでACから外した（旧AC#2）。DRAFT-47の整理（TASK-480）で対象と操作が決まったら、別タスクとして起票する。WorkEditDialogの外枠はTASK-475、effectの依存はTASK-476も触るので、476は抽出後の状態管理を作り直さない範囲にとどめる。
<!-- SECTION:NOTES:END -->
