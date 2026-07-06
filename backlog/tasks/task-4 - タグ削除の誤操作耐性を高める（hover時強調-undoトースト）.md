---
id: TASK-4
title: タグ削除の誤操作耐性を高める（hover時強調 + undoトースト）
status: To Do
assignee: []
created_date: "2026-07-05 17:58"
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

- [ ] #1 削除ボタンはチップのhover/focus時のみ強調表示し、通常時は薄く表示する
- [ ] #2 削除操作後に「タグ『○○』を削除しました / 元に戻す」の形式でundoトーストを表示する
- [ ] #3 保存中/失敗時の状態をチップ単位で表示する（失敗時に黙って元に戻るだけにしない）
<!-- AC:END -->
