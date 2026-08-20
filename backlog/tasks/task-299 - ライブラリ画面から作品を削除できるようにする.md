---
id: TASK-299
title: ライブラリ画面から作品を削除できるようにする
status: Done
assignee:
  - '@claude-sonnet'
created_date: '2026-08-10 19:00'
updated_date: '2026-08-19 16:54'
labels: []
dependencies:
  - TASK-285
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
物理ファイルを先に削除・移動するとライブラリ側に作品が残るが、ライブラリ画面に削除導線が無い。DELETE /works/:id（server/src/routes/works.ts:108-109）とdeleteWork()（client/src/features/files/api.ts:37-38）は存在するが、呼び出し元はファイルモードのFilePreview（client/src/features/files/ui/FilePreview.tsx:80-81）のみ。作品詳細パネル（client/src/features/library/ui/preview/WorkDetail.tsx / WorkMetadataActions.tsx）からライブラリ登録を解除できるようにする（確認ダイアログ付き、物理ファイルは消えない旨を明記）。

TASK-304でmissing軸は廃止され、現在はエラービュー（view: "error"、status !== "ok" を含む）に統合されている。エラービューから開いた欠損作品も同じ導線で削除できること（軸ではなく work.status === "missing" で判定できる）。欠損作品の一括削除はチェックボックス選択機構と合わせてDRAFT-53で扱う。unregisterWorkの退避メタ孤児化（TASK-285、完了済み）と関係するため整合に注意。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品詳細パネルから作品をライブラリから削除できる（確認ダイアログ付き）
- [x] #2 削除後、一覧と件数が即時更新される
- [x] #3 pnpm test:smoke が通る
- [x] #4 エラービュー（view: error）に現れる欠損作品も同じ導線で削除できる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. WorkMetadataActionsのその他メニューに区切り線+「作品登録を解除」を追加
2. WorkStatusWarningsのmissingバナーに「登録を解除」ボタンを追加（errorには追加しない）
3. 共通ConfirmDialogでFilePreviewと同文言の確認ダイアログ
4. deleteWork()再利用（必要ならentities/workへ移設）
5. 成功後: works系無効化 + detail(id)キャッシュ除去 + 選択解除（パネルを閉じる）
6. エラービュー0件時のビュー遷移を確認、破綻すればデフォルトビューへフォールバック
体制: feat/work-deletion統合ブランチ、worktree .worktrees/task-299、実装@claude-sonnet、TASK-355（欠損一括削除）が後続
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装: task-299ブランチ 44a3ea3（14ファイル、+243/-17）。deleteWork()をentities/work/api.tsへ移設しfeatures間横参照を解消。useLibraryWorkDeleteMutation（works系invalidate + detail(id) removeQueries + selectWork(null)）。導線は「その他」メニューとmissingバナーの2箇所、確認ダイアログはFilePreviewと同文言。エラービュー0件時の専用フォールバックは不要と判断（activeAxis=errorのまま既存の空状態UIが正常表示、実機確認済み。空なら空表示という既存設計に例外を持ち込まない）。pnpm check全通過・unit 824件・smoke 16/16（新規1本追加）。レビュー担当による副作用チェック: なし
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品詳細パネルの「その他」メニューとmissing警告バナーから作品登録を解除できるようにした（確認ダイアログ付き、物理ファイルは残る旨明記）。削除後は一覧・件数が即時更新され詳細パネルが閉じる。エラービューの欠損作品も同導線で削除可能で、最後の1件を消してもビュー遷移は破綻しない。check/unit/smoke全通過で検証済み
<!-- SECTION:FINAL_SUMMARY:END -->
