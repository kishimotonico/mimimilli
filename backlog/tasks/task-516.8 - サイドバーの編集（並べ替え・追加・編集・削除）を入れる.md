---
id: TASK-516.8
title: サイドバーの編集（並べ替え・追加・編集・削除）を入れる
status: Done
assignee: []
created_date: '2026-11-21 20:24'
updated_date: '2026-11-22 12:26'
labels:
  - library
  - ui
dependencies:
  - TASK-516.7
documentation:
  - docs/adr/0041-library-sidebar-shell-navigation.md
  - docs/adr/0042-pragmatic-drag-and-drop.md
  - docs/adr/0040-smart-folder-condition-tree.md
parent_task_id: TASK-516
priority: high
ordinal: 609000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0041「サイドバー」の編集の状態と ADR-0042 の実装。Pragmatic drag and drop を導入してサイドバーの並べ替えに使う（hitbox の list-item で前後、ドロップ後に全件の順序を PUT、ドラッグ中はクイックオーバーレイを出さない）。見出しの ＋ メニュー（今の検索の保存／絞り込みが無ければ複製・グループ分けの追加・既定から追加）、編集のダイアログ（名前・グループ分け・既定の並び〈「『すべて』と同じ」を含む〉・条件をルート直下の子ごとに × で外す。既定のものは条件を読み取り専用で見せ、名前・既定の並び・位置・削除だけ）、削除とトーストの「元に戻す」（サーバーの復元の口）。複製は元の既定の並びをそのまま写す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 導入時に @atlaskit/pragmatic-drag-and-drop 系の最新版・公開日と ADR-0042 が挙げた API 名（list-item の reorder-before / reorder-after など）を確かめ、違いがあればタスクのメモに残す
- [x] #2 編集の状態でドラッグして並べ替えると、再読み込み後もその順になる
- [x] #3 ＋メニューから、グループ分けの追加・既定から追加（消した既定が候補に出る）・絞り込み無しの複製（元の既定の並びを写す）ができる
- [x] #4 編集のダイアログで自作の条件を × で外すと件数が変わり、まとまりの最後の子を外すとまとまりごと消える。既定のものでは条件を外せない
- [x] #5 削除のトーストの「元に戻す」で、同じ ID・位置のまま戻り、履歴に残った URL も同じ行を開く
- [x] #6 「すべて」は名前・条件・グループ分けを変えられず、削除できない
- [x] #7 pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#1 確認 (2026-11-22): npm の最新は @atlaskit/pragmatic-drag-and-drop 4.0.0(2026-09-24)、-hitbox 3.0.0(2026-09-24)、-auto-scroll 3.2.1(2026-09-24)。今回は本体と hitbox を導入(auto-scroll はサイドバーのスクロールが短いので入れない)。ctx7 のドキュメントと導入した型定義で、ADR-0042 の API 名(hitbox/list-item の attachInstruction・extractInstruction、operation の reorder-before・reorder-after・combine)は一致。差異は、Instruction の判別キーが type でなく operation(blocked・axis も持つ)であること。ADR の記述に影響なし。

実装メモ: 並べ替えは hitbox list-item の前後(reorder-before/after)、ドロップ線は .is-drop-before/.is-drop-after。複製・グループ分けの追加は編集ダイアログを開いてから作成(名前の入力・×・並びを選べる)。ダイアログに件数の見込み表示は出していない(下書き条件の件数を数える口が無いため)。トーストは既存の単一ホスト(useToast)で、モックの暗色ピル・下部配置とは見た目が違う。
<!-- SECTION:NOTES:END -->
