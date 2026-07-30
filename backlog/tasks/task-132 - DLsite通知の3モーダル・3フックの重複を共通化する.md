---
id: TASK-132
title: DLsite通知の3モーダル・3フックの重複を共通化する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:29'
updated_date: '2026-07-30 16:25'
labels: []
dependencies: []
priority: medium
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite通知系（rj-missing / fetch-failed / parse-failed）でUI・model両層にほぼ同一のコピペ実装が3組ある。敵対的検証で「共通化を妨げる本質的差分なし」を確認済み。

UI側（計257行）: client/src/features/library/ui/RjCodeMissingModal.tsx(77行)・DlsiteFetchFailedModal.tsx(91行)・DlsiteParseFailedModal.tsx(89行)。dialogラッパー・className・header/footer・ページング「さらに読み込む」ボタンがほぼ一字一句同一。差分はタイトル・説明文・行内表示・ParseFailedのみのfooter追記程度。

model側: client/src/features/library/model/dlsiteFetchFailed.ts・dlsiteMissingRjCode.ts・dlsiteParseFailed.ts の3フックが useInfiniteQuery のページング集計（getNextPageParam・listTotal・flatMap・戻り値の形）を複製。さらに3フックとも WORK_QUERY_KEYS.dlsiteNotificationSummary() を個別 useQuery しており、既存の useDlsiteNotificationSummary.ts と同じ実装を4箇所に持つ（React Queryのdedupeで実害はないがコードの二重管理）。

方向: 共通シェル（NotificationListModal: header/footer/loading/loadMoreを引数化、行はrender prop）+ フックファクトリ（kind・countフィールドをパラメータ化、parse-failedの別スキーマはジェネリクスかコールバック注入で吸収）。サマリー取得は useDlsiteNotificationSummary を再利用する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 3モーダルが共通シェル+差分定義に畳まれ、見た目と操作（ページング・閉じる）が現状と同等
- [x] #2 3フックのuseInfiniteQueryロジックが共通ファクトリに統合され、サマリー取得はuseDlsiteNotificationSummary経由に一本化されている
- [x] #3 pnpm check・pnpm test が通り、該当ビジュアルテストがあれば更新されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 通知3モーダルを共通シェル(NotificationListModal)+render propへ
2. 3フックを共通ファクトリへ統合、サマリーはuseDlsiteNotificationSummary再利用
3. pnpm check + pnpm test:client + ビジュアルテスト確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-30: サーバー/契約側の統合を先行タスクとして起票（DLsite通知契約のdiscriminated union統合）。そちら→本タスクの順で着手すると全層一貫する。

Cursor(composer-2.5)で実装。NotificationListModal共通シェル+useDlsiteNotificationListファクトリへ統合、サマリーはuseDlsiteNotificationSummary再利用。-276/+89行+新規2ファイル。ビジュアルテストは通知モーダル非対象を確認。client check+test:client 389件+fmt:check通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite通知3モーダルを共通シェル+差分定義へ、3フックを共通ファクトリへ統合。TASK-149の契約統合と合わせて全層1系統になった。
<!-- SECTION:FINAL_SUMMARY:END -->
