---
id: TASK-322
title: scanダイアログの問題セクションを解決後に追従させる
status: To Do
assignee: []
created_date: '2026-08-12 16:54'
labels: []
dependencies: []
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ScanReview（client/src/features/scan/ui/scanModal/ScanReview.tsx）の問題セクションは、identity_conflictと不正sidecarをscan完了時点のスナップショットで表示する。Filesで競合を解決してscanダイアログへ戻っても表示が消えないため、解決済みの問題が残り続けているように見える。診断を再取得するか、解決操作の完了を検知して該当項目を落とす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Filesでidentity_conflictを解決した後にscanダイアログへ戻ると、その項目が問題セクションから消える
- [ ] #2 問題がゼロになったとき問題セクション自体が表示されない
- [ ] #3 上記を検証するテストがある
<!-- AC:END -->
