---
id: TASK-131
title: ConfirmDialogをネイティブdialog共通基盤へ統一しz-index 40/41の残骸を掃除する
status: To Do
assignee: []
created_date: '2026-07-30 12:28'
labels: []
dependencies: []
priority: medium
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/shared/ui/ConfirmDialog.tsx が旧世代のモーダル実装（手書きfixed div + zIndex 40/41 + windowイベントの手動Escape + 手動backdropクリック）のまま取り残されている。他の9モーダル（ScanModal・SettingsModal・WorkEditDialog等）はすべて useDialogModal（ネイティブ<dialog>+showModal()、top layer）へ移行済み（コミットfa98a9e）。

敵対的検証で確定した事実:
- z-index 40/41 を使うのは現在 ConfirmDialog.tsx のみ。docs/design-system.md の「Overlay/z-indexの現在の階層」表（37-52行）に40/41は存在せず、正典から漏れた孤立実装
- stale コメントが2箇所: ConfirmDialog.tsx:2「z-index は設定モーダルと同じ 40/41 の層」（SettingsModalはもうtop layer実装）、shell.css:1965「SettingsModal(z-index 40/41) より下に置く」
- 呼び出し元は WorkTagEditor.tsx:159（親のWorkEditDialogは既にネイティブdialog）。dialog内dialogのネストはHTML標準でサポートされ技術的ブロッカーなし

関連: TASK-119（モーダル閉じ経路統一）と同領域。同時対応も可。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ConfirmDialogがuseDialogModal（ネイティブdialog）で実装され、手書きz-index・手動Escape・手動backdrop処理が削除されている
- [ ] #2 ConfirmDialog.tsx:2 と shell.css:1965 のz-index 40/41言及が削除・修正されている
- [ ] #3 保護タグ削除の確認フロー（WorkEditDialog内から開閉・確認・キャンセル）が動作し、pnpm check・pnpm test が通る
<!-- AC:END -->
