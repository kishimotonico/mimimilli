---
id: TASK-145
title: 同一バッチ内のナビ操作でpush要求がreplaceに上書きされる問題を直す
status: To Do
assignee: []
created_date: '2026-07-30 12:33'
updated_date: '2026-07-30 13:08'
labels: []
dependencies: []
priority: medium
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
同一の同期ハンドラ内で push 系と replace 系のナビ操作を連続して呼ぶと、履歴コミット種別が単一スロットで上書きされ、push が消えて replace だけが実行される（敵対的検証済み・Codexレビュー指摘#19）。戻る/進むの履歴が期待どおり積まれない。

事実:
- client/src/features/navigation/model/navigationHistoryAtoms.ts:10-15 requestNavigationHistoryCommitAtom は kind を無条件上書き（push優先の合成なし）
- client/src/features/navigation/model/useNavigationHistory.ts:229-239 は最終の commit.kind だけを見て分岐
- 実際の発火箇所を特定済み: client/src/features/player/ui/PlayerDock.tsx:39-41 handleShowPlayingWork（setAppMode push → setLibraryAxis push → selectLibraryWork replace）と client/src/features/library/ui/DlsiteNotificationModals.tsx:28-29 の同型パターン。「再生中の作品を表示」で再現可能

方向: 同一バッチ内は push を優先する合成規則にする（kind = max(push, replace)）か、URL状態とcommit種別を一度に渡すtransaction型のactionへ変える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 「再生中の作品を表示」実行後にブラウザバックすると直前の画面へ戻れる（push が保持される）
- [ ] #2 同一バッチ内で push と replace が混在した場合の合成規則がテストで固定されている
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-30 設計メモ: push/replace宣言（requestNavigationHistoryCommitAtom）は libraryNavigationActions.ts（7箇所）・filesNavigationActions.ts（4箇所）・navigationAtoms.ts:15 に分散し、宣言忘れがlint・型で検出できない。合成規則の修正と合わせて、宣言をラップする単一ヘルパー（commitLibraryChange(set, kind, ...)等）へ集約すると再発防止になる。
<!-- SECTION:NOTES:END -->
