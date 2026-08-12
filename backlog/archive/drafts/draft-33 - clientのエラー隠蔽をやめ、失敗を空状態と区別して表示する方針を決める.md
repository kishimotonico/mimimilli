---
id: DRAFT-33
title: clientのエラー隠蔽をやめ、失敗を空状態と区別して表示する方針を決める
status: Draft
assignee: []
created_date: '2026-07-30 12:40'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー（Codex指摘#4/#15/#24/#25、2026-07-30の全体レビューで一部検証済み。全体は backlog doc-3 参照）で、client全域にわたり「取得失敗を空データ・0件・無言に畳む」パターンが確認された。個別修正の前に、エラー伝搬・表示の共通方針（どの層でerrorを保持し、空とどう区別して見せるか、バックグラウンド永続化の失敗をどこまで通知するか）を決める必要がある。

確認された箇所:
- client/src/features/files/ui/FilesView.tsx:67、client/src/features/library/model/useLibraryQueries.ts:137、dlsiteMissingRjCode.ts:8: Query失敗を[]/undefined/0件へ畳み、空フォルダー・ファセット0件・通知0件とAPI障害を区別できない
- server/src/adapters/real/fileTree.ts:11・fsBrowse.ts:51: FSブラウズが読めない子を欠落させ、stat失敗をサイズ0扱い（server側だがUI表現とセットの課題）
- client/src/app/App.tsx:84（再生失敗console.errorのみ）・App.tsx:147（export失敗の空catch）
- useResumePersistence.ts:22・useAudioEngineLifecycle.ts:183: resume/last-played永続化失敗の完全な握りつぶし（fire-and-forget自体は妥当という評価もあり、通知の要否は方針判断）

方針が決まったら個別タスクへ分割する。関連: TASK-142（設定APIエラーの誤表示。こちらは先行して単独修正）。
<!-- SECTION:DESCRIPTION:END -->
