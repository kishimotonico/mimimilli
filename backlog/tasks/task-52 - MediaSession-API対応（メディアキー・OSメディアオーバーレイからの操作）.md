---
id: TASK-52
title: MediaSession API対応（メディアキー・OSメディアオーバーレイからの操作）
status: To Do
assignee: []
created_date: '2026-07-18 21:03'
labels: []
dependencies: []
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
デスクトップでキーボードのメディアキーやOSのメディアオーバーレイ（Windowsのメディアフライアウト等）から再生/一時停止/前後トラックを操作でき、トラック名・作品名・カバー画像が表示されるようにする。

実装: navigator.mediaSession に metadata（title=トラック名、artist=サークル等、artwork=カバーサムネイルURL）と action handler（play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto）を配線する。positionState は TASK-50 のトラック相対時間（duration=トラック長、position=相対位置）を報告する。区間トラックでもOS側に正しい長さ・位置が出ること。

関連: client/src/features/player/model/usePlayer.ts（play/pause/nextTrack/prevTrack/seek等のアクション）、カバー画像はサムネイル配信APIを利用。モバイル対応（DRAFT-14に既存の言及あり）は本タスクのスコープ外だが、実装はモバイルでも流用できる汎用的な形にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 メディアキーで再生/一時停止・前後トラック操作ができる
- [ ] #2 OSのメディアオーバーレイにトラック名・作品名・カバー画像が表示される
- [ ] #3 区間トラック再生時、OS側の再生位置・長さがトラック相対（トラック長基準）で表示される
- [ ] #4 MediaSession非対応環境でもエラーなく従来どおり動く
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
