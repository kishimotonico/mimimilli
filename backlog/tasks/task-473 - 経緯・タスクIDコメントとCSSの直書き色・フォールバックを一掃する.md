---
id: TASK-473
title: 経緯・タスクIDコメントとCSSの直書き色・フォールバックを一掃する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 04:12'
labels:
  - cleanup
  - client
  - server
dependencies: []
priority: medium
ordinal: 531000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02のリポジトリ点検で、AGENTS.mdの「コメントに経緯を書かない」方針違反がTASK-447.10後も残っていた。client/src・server/src・shared/srcの約33ファイルにTASK-ID入りや「従来どおり」「移行プラン ステップ3で実装」等の経緯コメントがある（例: shared/src/api.ts, shared/src/scan.ts, server/src/routes/works.ts, server/src/adapter/index.ts:4, client/src/shared/ui/useDialogModal.ts, ScanModal.tsx, library-c.css）。またclient/src/styles/global.cssに var(--paper-0, #f7f5f1) 型の直書きフォールバック、影色 oklch(20% 0.02 70 / α) が約26箇所、--r-coralのalpha版 oklch(72% 0.165 25 / α) が約7箇所、モーダル暗幕色が各所に直書きされている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 client/src・server/src・shared/srcのコメントにTASK-ID（TASK-数字）が残っていない（rgで0件）
- [x] #2 経緯・旧実装・移行計画に触れるコメントが残っていない
- [x] #3 CSS変数参照に直書きの色フォールバックが無い
- [x] #4 影色・coralのalpha版・モーダル暗幕色がtokens.cssのトークン経由で参照され、直書きのoklch値が残っていない
- [x] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-08 追補: 没入モードの暗幕・text-shadow・drop-shadow も --immersive-ink・--immersive-text-shadow-ink・--shadow-black 経由にした。AC#4 の対象（影色・coralのalpha版・暗幕色）以外で、意図的な固有色として直書きを残すもの: CoverPlaceholder.tsx のカバー無し作品用の5色パレット（bg/fgの組で持つ装飾用の固有パレット）、library-d.css・files-a.css の暗い面専用の局所的な文字色 oklch(72〜82% 0.008 70) とエラー文字色 oklch(80% 0.12 25)（--ink-* は明るい背景用で役割が逆）、SmartFolderRuleCard.tsx のエラーカードの淡いcoral背景（1箇所のみで対応する面トークンが無い）、preview-a.css の暗い面の上の白alpha 2箇所。テストコードのTASK-IDコメント・テスト名も同じ追補で削除。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src・テストの経緯/TASK-IDコメントを削除。影・暗幕・coral・没入モードの直書き色を tokens.css の基底色トークン＋color-mix 経由にし、global.css のフォールバックを撤去。残す固有色は Notes に理由付きで記録。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
