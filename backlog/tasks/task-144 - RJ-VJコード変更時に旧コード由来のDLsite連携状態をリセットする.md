---
id: TASK-144
title: RJ/VJコード変更時に旧コード由来のDLsite連携状態をリセットする
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:33'
updated_date: '2026-07-30 16:26'
labels: []
dependencies: []
priority: medium
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
RJコードだけ変更して保存すると、旧コードに紐づく applied/status/error/errorKind/appliedTags がそのまま新コードの状態として残る（敵対的検証済み・Codexレビュー指摘#13）。適用済み表示のままbulk取得対象からも外れる。

事実:
- server/src/adapters/real/index.ts:892-911 updateDlsiteState は patch.rjCode のみの変更時、...work.dlsite スプレッドで status/error/appliedTags を維持する（patch.skipped 指定時のみリセット）。fixture/index.ts:700付近も同様
- client/src/features/library/ui/preview/DlsiteEditor.tsx:173-184,283-285 の「コードを保存」ボタンは updateDlsiteState のみを呼び、fetchは強制されない。実際に到達可能なUI導線

方向: コード変更時の状態遷移を real/fixture 共通の関数へまとめ、旧コード由来の結果・エラーをクリアして未取得状態に戻す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 RJコードを変更して保存すると status が未取得系にリセットされ、旧 appliedTags/error が残らない（real・fixture両方、テストあり）
- [x] #2 コード変更後の作品がbulk取得の対象に含まれる
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. コード変更時の状態遷移をreal/fixture共通関数へ
2. 旧コード由来のstatus/error/appliedTagsをリセットし未取得状態へ
3. bulk対象に入ることの確認テスト
4. pnpm check + pnpm test:server
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。状態遷移をshared/src/dlsite.tsのapplyDlsiteStatePatch純関数へ集約しreal/fixture両アダプタから利用。同値再保存はリセットしない・skipped挙動維持。全体check+test:server 350件+test:client 389件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
RJ/VJコード変更時に旧コード由来のstatus/error/errorKind/appliedTagsを未取得状態へリセット。real/fixture共通の純関数化で挙動分岐も解消。
<!-- SECTION:FINAL_SUMMARY:END -->
