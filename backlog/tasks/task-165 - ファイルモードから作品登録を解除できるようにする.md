---
id: TASK-165
title: ファイルモードから作品登録を解除できるようにする
status: Done
assignee:
  - '@claude'
created_date: '2026-08-01 18:02'
updated_date: '2026-08-01 19:55'
labels: []
dependencies:
  - TASK-164
priority: medium
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: ファイルモード要件整理 2026-08-02（本会話でユーザー合意）。作品削除API/UIが存在せず、誤登録や不要になった作品の登録を解除する手段がない。

要件（ユーザー合意済み）:
- 作品削除API: メタファイル（.meta.json）とDB上の作品データ（履歴・タグ含む）を削除する。音声等の物理ファイルは一切触らない
- ファイルモードの登録済みフォルダに「作品登録を解除」アクション＋破壊的操作の確認ダイアログを追加する（何が消えるかを明示する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 登録済みフォルダに対して「作品登録を解除」アクションから確認ダイアログを開き、削除される内容（履歴・タグを含む作品データ）が明示される
- [x] #2 解除を実行すると.meta.jsonとDB上の作品データ（履歴・タグ含む）が削除される
- [x] #3 解除操作の前後で音声等の物理ファイルが一切変更・削除されない
- [x] #4 解除後、同じフォルダは未登録フォルダとしてファイルモードに表示される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 作品削除API: mimimilli.jsonとDB作品データ（履歴・タグ含む）を削除、物理ファイル不変（TASK-164の子作品解除ロジックと共通化）
2. ファイルモードの登録済みフォルダに「作品登録を解除」アクション＋破壊的操作の確認ダイアログ（消える内容を明示）
3. 解除後は未登録フォルダとして表示
4. 実装はCursor(composer-2.5)へ委譲、Sonnet検証担当が自動テスト+実機確認（検証用の残存作品をUIから解除して片付ける）
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装エージェント引き継ぎ用の調査済み事実（別セッション調査、2026-08-02）:
- 作品削除APIも存在しない。削除対象は.meta.json＋DBの作品行（履歴・タグ含む）で、物理音声ファイルは触らない
- 環境メモ: 開発サーバーはdev:realで起動している場合がある（実DB。fixtureと挙動が違う点に注意）

Cursor実装+Sonnet検証(実機)で完了。pnpm check/test全通過(server409/client601)。実機でAC1-4確認、SHA256でAC3担保。検証用作品8件をこの解除機能自体で片付け（ドッグフーディング成功）。コミットc847f84
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品削除API DELETE /api/works/:id と解除UI（破壊的操作の確認ダイアログ付き）を追加。DB作品データ+mimimilli.jsonのみ削除し物理ファイル不変。TASK-164のunregisterWork()を共通利用。自動テスト+実機検証で全AC合格
<!-- SECTION:FINAL_SUMMARY:END -->
