---
id: TASK-39
title: 作品編集ダイアログの導入（タイトル・タグ・DLsite連携の集約）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 12:19'
updated_date: '2026-07-17 12:47'
labels: []
dependencies:
  - TASK-38
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細の編集系UIを1つの編集ダイアログに集約し、閲覧ビューを表示専念にする。現状はタイトル編集が「…」メニュー→ポップオーバー、タグがチップ直接編集、DLsite連携（RJコード入力・コードを保存・DLsiteから取得・連携しないチェック）が常時表示のフォームとバラバラで、通常操作では不要なUIが詳細の一等地を占有している。

方針:
- 鉛筆アイコン（編集）→ useDialogModal（TASK-29のネイティブdialog共通基盤）ベースのtop layerダイアログを開き、タイトル・タグ・DLsite連携をまとめて編集する
- 閲覧ビューからDlsitePanelを撤去。連携状態は小さなバッジ（kicker統合など）で示し、エラー・未連携など行動が必要な状態のみWorkStatusWarnings系で見せる
- DLsite取得成功時の適用プレビューダイアログ（現状<dialog open>手製backdropでuseDialogModal基盤に乗っていない）も共通基盤へ統合する
- 既存のタイトル編集ポップオーバー・「…」メニューの役割整理も合わせて行う

関連: client/src/features/library/ui/preview/WorkDetail.tsx, DlsitePanel.tsx, WorkMetadataActions.tsx, WorkTagEditor.tsx, shared/ui/useDialogModal.ts, docs/design-system.md（z-index/top layer規約）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 閲覧ビューにDLsite連携フォームが常時表示されず、連携状態はバッジ等の最小表示になる
- [x] #2 鉛筆アイコンから開くダイアログでタイトル・タグ・DLsite連携（RJコード保存・取得・連携しない）を編集できる
- [x] #3 DLsite適用プレビューダイアログを含む関連ダイアログがuseDialogModal基盤（top layer・Esc・フォーカストラップ）に統合される
- [x] #4 エラー・未連携など行動が必要なDLsite状態は閲覧ビューでも気づける
- [x] #5 ビジュアルベースラインが新レイアウトに更新される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 実装はCodexに委譲（メイン作業ツリー、TASK-41エージェントはworktree側なので衝突なし）
2. WorkMetadataActionsに鉛筆アイコン→useDialogModalベースの「作品を編集」ダイアログ（タイトル・タグ・DLsite連携を集約）
3. 閲覧ビューからDlsitePanel撤去、状態はkickerバッジ＋WorkStatusWarningsで表示
4. DLsite適用プレビューダイアログをuseDialogModal基盤へ統合
5. check/testはCodex側、ビジュアルベースライン更新と実機検証・コミットはClaude側
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex(019f7011)に実装委譲。WorkEditDialog/DlsiteEditor新設・DlsitePanel削除・.mle-dlsite系CSS削除・design-system.md更新。適用プレビューはbodyへポータルしuseDialogModal基盤の多重top layerで表示。レビューで発見したバグ: Reactの合成イベントはReactツリー伝播のため、ポータル先のdialogのEsc(cancel)が親dialogのonCancelにも届き両方閉じる→useDialogModal.handleCancelにstopPropagation追加で修正（Claude）。実機検証: バッジ表示・鉛筆→ダイアログ・DLsite取得→適用プレビュー重なり・Esc段階クローズOK。check/test/visualベースライン更新済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タイトル・タグ・DLsite連携の編集を鉛筆アイコン→useDialogModalベースの作品編集ダイアログに集約。閲覧ビューからDLsiteフォームを撤去しkickerバッジ＋警告導線に変更。適用プレビューダイアログも共通基盤へ移行し、多重モーダルのEsc伝播バグをuseDialogModalで修正。実機検証・ビジュアルベースライン更新済み。
<!-- SECTION:FINAL_SUMMARY:END -->
