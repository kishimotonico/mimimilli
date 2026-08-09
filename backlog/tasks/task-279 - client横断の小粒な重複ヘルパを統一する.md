---
id: TASK-279
title: client横断の小粒な重複ヘルパを統一する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 00:30'
labels: []
dependencies: []
priority: low
ordinal: 289000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した横断的な小規模重複。Codexレビュー反映で2点を修正した。
- 日付フォーマットが3箇所（library/ui/preview/format.ts / ScanModal.tsx:34 / SettingsModal.tsx:67。最終スキャン時刻の toLocaleString("ja-JP")+「未実行」も重複）→ shared/lib/format.ts に集約
- DLsite ApiRequestError→ユーザー文言の4分岐が RegisterWorkDialog.tsx:24-28 と DlsiteEditor.tsx:31-35 で完全一致 → 共有ヘルパへ
- formatErrorMessage / formatStartupError の同一パターン（RootErrorBoundary.tsx:12 / StartupErrorScreen.tsx:9）→ formatUserError に統一
- tags/tagOp の組み立て共通化は library/api.ts 内の3経路（:38-47,63-67,124-130）に限定する。navigationUrl.ts:195-206 は tags のみで tagOp を持たないURL codecなので独立のまま（当初の4箇所統合を修正）
- FOCUSABLE_SELECTOR の重複（useDialogModal.ts:4 / usePopoverDismissal.ts:4）と mapDismissReason の同一実装2箇所（useAnchoredPopover.ts:40 / usePopoverDismissal.ts:21）→ 1箇所化
- definitionOf（parseTag→tagPrefixes.find）の重複（WorkTagEditor.tsx:94-97 / RegisterWorkDialog.tsx:117-120）→ entities/tag へ
- サムネ幅の ceil/nearest 2関数（coverThumbnailWidth.ts / gridSizing.ts）は意図的な使い分け（画質優先/列幅優先）なので、意味別wrapperを維持し共通化するとしても内部プリミティブのみ（当初の単純統合を修正）
- NotificationBell.tsx:63-84 の手動外側クリック/Escape実装 → usePopoverDismissal へ統一
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 日付・エラー文言・フォーカス系・タグクエリの各ヘルパが1実装に統一され、全呼び出し箇所が置き換わっていること
- [ ] #2 NotificationBell が共有dismissal機構を使っていること
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
