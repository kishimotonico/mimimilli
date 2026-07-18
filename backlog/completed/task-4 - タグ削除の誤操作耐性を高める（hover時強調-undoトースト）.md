---
id: TASK-4
title: タグ削除の誤操作耐性を高める（hover時強調 + undoトースト）
status: Done
assignee:
  - '@fable'
created_date: '2026-07-05 17:58'
updated_date: '2026-07-10 00:48'
labels:
  - ui
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細でタグチップの削除ボタンが常時表示され、クリックすると即時保存される。分類情報をワンクリックで失う操作としては軽すぎ、タグ追加ボタンや再生アクションが近くに並ぶため誤クリックの可能性がある。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 削除ボタンはチップのhover/focus時のみ強調表示し、通常時は薄く表示する
- [x] #2 削除操作後に「タグ『○○』を削除しました / 元に戻す」の形式でundoトーストを表示する
- [x] #3 保存中/失敗時の状態をチップ単位で表示する（失敗時に黙って元に戻るだけにしない）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. タグチップ削除UIの現状把握(editableTags/TagCombobox周辺) 2. 削除ボタンをhover/focus時のみ強調 3. undoトースト(削除タグ名+元に戻す) 4. チップ単位の保存中/失敗表示 5. テスト・check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sonnetエージェント実装、Fableがレビュー・agent-browserで実画面検証。削除→undoトースト→復元、PATCH失敗シミュレーション（fetchモンキーパッチ）でチップの失敗表示+role=alertエラー+再試行導線を確認。hover強調はTailwind v4のhover variantが@media (hover:hover)ゲート付きのためheadlessでは発火しない（実Chromeでは有効、CSSは正しい）。Toastはshared/ui/Toast.tsxとして新設（単一スロット、z=45、motion/react）。pnpm check・test:client 79件・ビジュアルテスト全パス（スナップショット差分は許容内で更新不要）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグ削除ボタンを通常時薄く・hover/focus時強調に変更、削除後6秒のundoトースト（元に戻すで全復元）、チップ単位のpendingスピナー/失敗表示+再試行導線を追加。コミット 4391cd4。
<!-- SECTION:FINAL_SUMMARY:END -->
