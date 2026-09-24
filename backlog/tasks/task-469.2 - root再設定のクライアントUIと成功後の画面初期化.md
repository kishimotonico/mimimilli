---
id: TASK-469.2
title: root再設定のクライアントUIと成功後の画面初期化
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - settings
  - ui
dependencies:
  - TASK-469.1
parent_task_id: TASK-469
priority: high
ordinal: 528000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
S1の4（成功後の画面初期化、失敗時のエラー・再試行）と、root変更中の操作制限・再生停止をクライアントに実装する。rootだけ先に変えてFilesを閲覧する操作、切替をまたぐ再生（client/src/features/files/model/filePlayback.ts、client/src/features/player/model/playerRuntime.ts経由）を廃止する。

再設定中に取消ができるかどうかはS1.1のADRで定める契約に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 root変更操作を開始すると、再設定中は通常のLibrary/Files操作ができなくなる。成功または取消でのみ通常利用へ戻れる(取消の可否はADRで定める)
- [ ] #2 再生中コンテンツは再設定開始時に停止する
- [ ] #3 再設定成功後、Libraryのquery・選択・候補状態が初期化されて通常画面へ戻る
- [ ] #4 再設定失敗時は専用画面内でエラーが表示され、再試行できる
- [ ] #5 rootだけ先に変更してFilesを閲覧する操作、および切替をまたぐ再生ができないことがテストで確認されている
- [ ] #6 pnpm test:smoke が通る(root変更UIのレイアウト変更を含む)
- [ ] #7 pnpm check && pnpm test が通る
<!-- AC:END -->
