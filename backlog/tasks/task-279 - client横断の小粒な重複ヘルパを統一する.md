---
id: TASK-279
title: client横断の小粒な重複ヘルパを統一する
status: Done
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 03:28'
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
- [x] #1 日付・エラー文言・フォーカス系・タグクエリの各ヘルパが1実装に統一され、全呼び出し箇所が置き換わっていること
- [x] #2 NotificationBell が共有dismissal機構を使っていること
- [x] #3 clientのcheck・変更範囲のテスト・smokeが通ること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
formatUserError は fallback を呼び出し側から渡す形にし、RootErrorBoundary の「予期しないエラーが発生しました」と StartupErrorScreen の「設定の取得に失敗しました」を両方保った。navigationUrl.ts の tags 組み立ては tagOp を持たないURL codecのため独立のまま維持。サムネ幅は ceil（画質優先）と nearest（列幅優先）の2規則を維持したうえで shared/src/api.ts の THUMBNAIL_WIDTHS 定義元へ集約し、戻り値型を ThumbnailWidth にして client 側の型アサーションを解消した。shared の normalizeThumbnailWidth とは同距離時の丸めが異なり（< と <=、target=192 で 128 と 256）、統一すると gridSizing.test.ts の期待値と表示解像度が変わるため統合しない判断。NotificationBell の手動dismissal を usePopoverDismissal へ寄せたことで、閉じる際にアンカーへフォーカスが戻る挙動が加わる（共有フックの仕様に揃えたもの）。検証: pnpm check 成功、client 781テスト・server 525テスト・smoke 10件全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
日付フォーマット・DLsiteエラー文言・エラー整形・FOCUSABLE_SELECTOR・mapDismissReason・definitionOf を各1実装へ統一し、NotificationBell を共有dismissal機構へ寄せた。サムネ幅の2規則は意味別に維持したまま shared へ集約し型を厳密化。文言・挙動の退行なし。pnpm check と client 781 / server 525 テスト・smoke 10件で検証。
<!-- SECTION:FINAL_SUMMARY:END -->
