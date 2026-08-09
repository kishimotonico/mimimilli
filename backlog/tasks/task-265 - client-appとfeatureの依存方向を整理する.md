---
id: TASK-265
title: client appとfeatureの依存方向を整理する
status: Done
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 01:17'
labels: []
dependencies: []
priority: medium
ordinal: 275000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した app↔feature の逆依存。
- app/ui/Breadcrumbs.tsx を features/library/LibraryBreadcrumbs と features/files/FilesBreadcrumbs がimport → shared/ui/Breadcrumbs へ移動
- app/model/useGlobalShortcuts.ts を features/player/PlayerRuntime がimport → features/player/model へ移動
- Codexレビュー反映（漏れ2件）: features/files/ui/FilePreview.tsx:4 と features/library/ui/DlsiteNotificationModals.tsx:3-4 にも feature→app のimportがある。個別列挙に頼らず、rgによる機械的検査で全件を洗い出して解消する
- App.tsx:127-145 のライブラリエクスポート実装（Blob生成・download名）→ features/library へ移し、Appはコールバックを渡すだけにする
- features/files/FileColumn.tsx が features/library/ui/CollectionStatus をimport → shared/ui へ昇格
- app/ui/AddressBar.tsx が library/files の部品を直接組み立てている点は、shellのcompositionとしての意図を確認し、意図的なら現状維持で良い（判断を統括へ報告）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App.tsx からエクスポートのドメイン実装が消えていること
- [x] #2 CollectionStatus の feature間importが解消されていること
- [x] #3 clientのcheck・変更範囲のテストが通ること
- [x] #4 client/src/features 配下から app/ へのimportが0件であることをrgで機械的に確認していること（app→featureのcompositionは許可）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
初回実装は移動元の削除漏れ（Breadcrumbs・CollectionStatus が2箇所に重複）と0バイト空ファイル2件があり差し戻した。修正後は移動元削除・旧パス参照0件・互換re-exportなしを確認。DlsiteNotificationModals が app/model/activeModal から型・関数をimportしていた feature→app 違反も併せて解消し、features/library/model/dlsiteNotificationModal.ts へ切り出した。移動したコンポーネントはDOM構造・className・inline styleとも移動前と完全一致（レビュー担当が diff で照合）。AddressBar.tsx は shell の composition として現状維持。検証: pnpm check 成功、client 102ファイル/775テスト全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Breadcrumbs・CollectionStatus を shared/ui、errorToastAtom を shared/model、useGlobalShortcuts を features/player/model へ移動。App.tsx のライブラリエクスポート実装を features/library へ切り出した。features から app へのimportは rg で0件。pnpm check と client 775 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
