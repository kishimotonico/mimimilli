---
id: TASK-55
title: usePlayerの責務分割（エンジンライフサイクル・レジューム永続化・アクションの3分割）
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-19 01:33'
updated_date: '2026-07-19 01:34'
labels: []
dependencies: []
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/player/model/usePlayer.ts が530行超に肥大化（TASK-50〜53で増加）。リファクタリング調査（2026-07-19）の提案に基づき責務を分割する。

分割方針:
- useAudioEngineLifecycle: engine生成/破棄と onPlay/onPause/onTimeUpdate/onDurationChange/onEnded/onError の配線。finishCurrentTrack（loop・A-Bリピート判定・聴了リセット含む）もここに閉じる
- useResumePersistence: pendingResume処理・5秒間隔保存・一時停止時保存。saveCurrentResumeヘルパーもここへ
- 本体 usePlayer: 上記を合成し、play/seek/setVolume等のアクションだけを持つ薄い層
- useMediaSession（TASK-52で分離済み）・trackTime.ts はそのまま

制約: フックの公開API（返却値・引数）と外部から見た挙動は一切変えない。既存テスト（usePlayer.test.ts 等）が無修正で通ることが挙動不変の証明。ref共有（engineRef・loadedTrackRef・trackEndedRef等）の受け渡し設計が肝なので、分割の切れ目はテストが通る範囲で調整してよい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 usePlayerが責務ごとに複数モジュールへ分割され、本体は薄い合成層になる
- [ ] #2 フックの公開APIが変わらず、既存テストが無修正で通る
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
