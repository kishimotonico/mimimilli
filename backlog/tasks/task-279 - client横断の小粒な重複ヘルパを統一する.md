---
id: TASK-279
title: client横断の小粒な重複ヘルパを統一する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies: []
priority: low
ordinal: 289000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した横断的な小規模重複。
- 日付フォーマットが3箇所（library/ui/preview/format.ts / ScanModal.tsx:34 / SettingsModal.tsx:67。最終スキャン時刻の toLocaleString("ja-JP")+「未実行」も重複）→ shared/lib/format.ts に集約
- DLsite ApiRequestError→ユーザー文言の4分岐が RegisterWorkDialog.tsx:24-28 と DlsiteEditor.tsx:31-35 で完全一致 → 共有ヘルパへ
- formatErrorMessage / formatStartupError の同一パターン（RootErrorBoundary.tsx:12 / StartupErrorScreen.tsx:9）→ formatUserError に統一
- tags/tagOp の URLSearchParams 組み立てが4箇所（library/api.ts:40-41,64-65,125-126 / navigationUrl.ts:201）→ buildTagQueryParams に集約
- FOCUSABLE_SELECTOR の重複（useDialogModal.ts:4 / usePopoverDismissal.ts:4）と mapDismissReason の同一実装2箇所（useAnchoredPopover.ts:40 / usePopoverDismissal.ts:21）→ 1箇所化
- definitionOf（parseTag→tagPrefixes.find）の重複（WorkTagEditor.tsx:94-97 / RegisterWorkDialog.tsx:117-120）→ entities/tag へ
- サムネ幅選択の ceil/nearest 2関数分裂（entities/work/ui/coverThumbnailWidth.ts / library/model/gridSizing.ts）→ 集約し用途を明示
- NotificationBell.tsx:63-84 の手動外側クリック/Escape実装 → usePopoverDismissal へ統一
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 日付・エラー文言・フォーカス系・タグクエリの各ヘルパが1実装に統一され、全呼び出し箇所が置き換わっていること
- [ ] #2 NotificationBell が共有dismissal機構を使っていること
- [ ] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->
