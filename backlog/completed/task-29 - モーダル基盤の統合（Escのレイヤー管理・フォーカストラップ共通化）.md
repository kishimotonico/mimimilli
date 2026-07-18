---
id: TASK-29
title: モーダル基盤の統合（Escのレイヤー管理・フォーカストラップ共通化）
status: Done
assignee: []
created_date: '2026-07-10 10:39'
updated_date: '2026-07-12 06:16'
labels:
  - ui
dependencies: []
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設定モーダル・スキャン結果ポップアップ・スマートフォルダーエディタがそれぞれ独自のEsc/outside-click/フォーカス管理を持つ。NewWorkPopupのEsc伝播バグ（局所修正済み予定）の根本対策として、最前面だけが閉じるレイヤー管理を持つ共通モーダル基盤（またはネイティブdialogへの統一。前例: FullScreenPlayer）に統合する。単純な共通useEscapeでは不十分。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 3つのモーダル系UIが共通基盤（またはnative dialog）上で動く
- [x] #2 モーダル多重時にEscは最前面だけを閉じる
- [x] #3 フォーカストラップとbackdropクリックの挙動が統一される
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnet実装、Fableレビュー・実機検証。useDialogModal（開閉ライフサイクル+cancel委譲+backdrop判定のみの薄いフック）で3モーダルをnative dialog化。Escとbackdropで既存挙動が異なる点（Escは内側優先、backdropは問答無用で閉じる）をコールバック分離で正確に維持。実機確認: dialog[open]+フォーカス内包、設定のEsc2段階、Tab12回でフォーカスがdialog内に留まる（ネイティブトラップ）、backdropクリックで閉じる、スキャン完了ダイアログのセンタリング。check・client 168件・server 139件・ビジュアル6件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SettingsModal/NewWorkPopup/SmartFolderEditorModalをnative dialog+useDialogModalに統合。フォーカストラップとEsc階層はtop layerに委譲、モーダルごとのbackdrop挙動差はオプションで明示。
<!-- SECTION:FINAL_SUMMARY:END -->
