---
id: TASK-55
title: usePlayerの責務分割（エンジンライフサイクル・レジューム永続化・アクションの3分割）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 01:33'
updated_date: '2026-07-19 01:40'
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
- [x] #1 usePlayerが責務ごとに複数モジュールへ分割され、本体は薄い合成層になる
- [x] #2 フックの公開APIが変わらず、既存テストが無修正で通る
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. usePlayerの共有ref・再生コンテキストの境界を定義する\n2. Audio engineの生成・イベント配線・トラック読込・終端処理をuseAudioEngineLifecycleへ分離する\n3. pending resume・定期保存・一時停止保存をuseResumePersistenceへ分離し、usePlayerをアクション中心の合成層にする\n4. 既存対象テスト、pnpm check、pnpm testで挙動不変を検証する\n5. 受け入れ条件と実装記録をBacklogへ反映して完了する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装判断: Audio engineの生成・破棄、イベント配線、トラック読込、同一asset切替、finishCurrentTrackをuseAudioEngineLifecycleへ移した。pending resumeの解決、saveCurrentResume、5秒間隔保存、一時停止時保存はuseResumePersistence.tsへ移した。元実装とeffect登録順を揃えるため、同モジュール内でcontroller準備と保存effect登録を分け、usePlayerではengine lifecycleの後に保存effectを登録した。共有refと内部型はplayerRuntime.tsに集約した。公開APIと既存テストは変更していない。

検証結果: pnpm check 成功。pnpm test 成功（server 20件、client 32ファイル・233件）。対象のusePlayer.test.ts、useMediaSession.test.ts、trackTime.test.tsは無修正。git diff --checkも成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
usePlayerをアクション中心の合成層へ縮小し、Audio engine lifecycleとresume永続化を専用フックへ分離した。共有refは内部型で明示し、effect順を維持して挙動を変えずに整理した。pnpm checkとpnpm testが成功し、既存テストは無修正で通過した。
<!-- SECTION:FINAL_SUMMARY:END -->
