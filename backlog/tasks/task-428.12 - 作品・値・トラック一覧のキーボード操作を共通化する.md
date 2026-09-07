---
id: TASK-428.12
title: 作品・値・トラック一覧のキーボード操作を共通化する
status: To Do
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:12'
labels:
  - ui
  - keyboard
  - accessibility
dependencies: []
modified_files:
  - client/src/features/library/ui/WorkListPane.tsx
  - client/src/features/library/ui/WorkGrid.tsx
  - client/src/features/library/ui/preview/WorkTrackList.tsx
parent_task_id: TASK-428
priority: high
ordinal: 439000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib-browse-A-04/A-13/A-14、work-detail-A-13。作品・値・トラック一覧でキーボード操作の有無と挙動が揃わず、Enter・矢印・Home/Endの意味も一覧ごとに違う。共通のキーボード操作契約へ揃える。

前提（統合済みの変更）: TASK-428.24 が WorkGrid.tsx / WorkListPane.tsx の works.length === 0 の分岐内にスマートフォルダー専用の空状態を追加済み（追加した3つのprops isSmartFolder / onEditSmartFolderRules / onClearAllFilters はすべて optional・デフォルト値あり。virtualizer・ジャスティファイドレイアウト・キーボードナビゲーション・タイル/行の描画には触れていない）。TASK-428.9 が同2ファイルから resultsBanner props を削除し、描画を LibraryView 側の1箇所へ集約済み（resultsBanner は .mll-results の外へ移動）。TASK-428.5 が WorkTile.tsx にダブルクリック/Enterでの再生ガード（isPlayable = work.status === "ok"）を追加済み。

TASK-428.13 が確定させたショートカット・Escape契約に従うこと（モーダル dialog 中は全キー無効化、除外セレクタは input/textarea/select/[contenteditable]/[role=menu]/[role=listbox]/button/a、data-player-control 属性を持つプレイヤー操作ボタンにフォーカスがあるときだけ Space はグローバルの再生トグルへ、Escape はレイヤーごとに一段だけ閉じる、IME変換中は無視）。docs/design-system.md の「グローバルショートカット / Escape」節に記載がある。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 各一覧へTab一回で入り、Tab一回で次の領域へ離脱できる
- [ ] #2 上下・グリッド左右・Home・Endで項目間を移動できる
- [ ] #3 仮想化された項目へ移動後に表示とfocusが一致する
- [ ] #4 Enterの主操作とEscapeの選択解除が一覧種別ごとの仕様どおり動く
- [ ] #5 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
