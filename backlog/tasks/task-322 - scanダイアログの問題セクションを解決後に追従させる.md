---
id: TASK-322
title: scanダイアログの問題セクションを解決後に追従させる
status: To Do
assignee: []
created_date: '2026-08-12 16:54'
updated_date: '2026-08-13 19:21'
labels: []
dependencies:
  - TASK-326
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ScanReviewの問題セクションは、identity_conflictと不正なmimimilli.jsonをscan完了時点のスナップショットで表示する。Filesで競合を解決してscanダイアログへ戻っても表示が消えないため、解決済みの問題が残り続けているように見える。診断を再取得するか、解決操作の完了を検知して該当項目を落とす。

2026-08-14: スキャンモーダル再構成（TASK-326）で要対応タブとして作り直すため、そこで一緒に解消する。単独では着手しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Filesでidentity_conflictを解決した後にscanダイアログへ戻ると、その項目が問題セクションから消える
- [x] #2 問題がゼロになったとき問題セクション自体が表示されない
- [ ] #3 上記を検証するテストがある
<!-- AC:END -->
