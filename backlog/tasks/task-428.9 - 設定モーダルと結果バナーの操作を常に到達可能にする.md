---
id: TASK-428.9
title: 設定モーダルと結果バナーの操作を常に到達可能にする
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 19:32'
labels:
  - ui
  - layout
  - settings
dependencies: []
modified_files:
  - client/src/features/settings/ui/SettingsModal.tsx
  - client/src/features/library/ui/ErrorViewBulkUnregisterBanner.tsx
parent_task_id: TASK-428
priority: high
ordinal: 436000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
settings-setup-errors-A/B-04/05。設定本文の固定上限と内側スクロールで下部項目へ到達しにくく、エラー作品の一括操作もプレビューに隠れる。header/body/footerのスクロール責務とバナーの所属幅を整理する。

前提（統合済みの変更）: TASK-428.21 が設定モーダルの生button 9箇所を共通Button/IconButtonへ置換し、SECONDARY_BUTTON_CLASS を削除済み。TASK-428.6 がルートフォルダーの検証・保存中state・inline notice / inline error を追加済み（どちらもスクロール領域を新設せず本文と一緒に流れる想定）。TASK-428.5 が ErrorViewBulkDeleteBanner を ErrorViewBulkUnregisterBanner へ改名し、エラービューの操作名を「登録解除」に統一済み（「削除」は物理ファイルの文脈にのみ使う）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 設定モーダルのbodyだけがスクロールし、header/footerは維持される
- [x] #2 prefix・除外フォルダー・エクスポートへマウスとTabの両方で到達できる
- [x] #3 プレビュー表示中もエラー作品の一括操作が隠れずクリックできる
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 設定モーダルのbody以外に入れ子のスクロール領域を置かない（prefix一覧・除外フォルダー一覧はmax-heightと内側スクロールを持たず本文と一緒に伸びる）
<!-- AC:END -->
