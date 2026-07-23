---
id: TASK-88
title: axis-landingプレビューのページング200件頭打ちを解消
status: Done
assignee: []
created_date: '2026-07-23 05:59'
updated_date: '2026-07-23 10:22'
labels: []
dependencies: []
priority: high
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-73で /works が常時 WORKS_DEFAULT_PAGE_SIZE=200 ページングになったが、軸未ドリル/タグ選択時に出る AxisLanding(client/src/features/library/ui/preview/AxisLanding.tsx:20、呼び出しLibraryView.tsx:260-261)にはLoadMore/無限スクロールが無く、件数表示もカード一覧もサイレントに最大200件で打ち切られる。ページング導入前は全件返却で正しく表示できていた追従漏れ。ユーザーに見える誤情報だが再現条件が分かりにくい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 axis-landingが正しい総件数を表示する(サーバー総件数の別取得等、smartFolderのtotalと設計を揃える)、または『先頭N件のプレビュー』であることをUIで明示し仕様として固定する
- [ ] #2 選んだ方針に対応するテスト(件数/表示の期待値)が追加されている
<!-- AC:END -->
