---
id: TASK-50
title: マルチトラック（1ファイル内区間トラック）の再生をトラック相対時間に修正する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-18 20:23'
updated_date: '2026-07-18 20:40'
labels: []
dependencies: []
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track契約（shared/src/work.ts:12-18）は start/end による「1ファイル内の区間トラック」を想定しているが、プレイヤーはロード時に track.start へ一度シークするだけ（usePlayer.ts:139-143, audioEngine.ts:177-178）で、時間表示・duration・シークバー・終了判定はすべてファイル全体の絶対時間のまま動く。結果、トラック指定再生が「ファイル全体の途中から再生」に見え、再生時間もファイル全体長になる。

対応方針（ユーザー確定済み）: client側でトラック相対時間化のみ行う。あたかも独立したファイルを再生しているように振る舞わせる。トラック区間データの生成手段（CUEインポート・編集UI）は今回のスコープ外（start/endは手動メタ編集前提）。

修正ポイント:
- currentTime/duration をトラック相対に変換（duration = end-start、endがなければ audio.duration - start 相当）: usePlayer.ts:72,74 → atoms.ts:52,58
- onTimeUpdate で time >= track.end を検知したらトラック終了として次トラック送り/停止（ネイティブendedはファイル末尾でしか発火しない。既存A-Bリピート usePlayer.ts:67-73 と同パターンで実装可能）
- seek/useSeekDrag はトラック相対時間を受け取り、absolute = track.start + relative に変換して engine.seek（usePlayer.ts:253, useSeekDrag.ts:40-57）
- 表示側 BarContent.tsx:28-32, PopupContent.tsx:60-73, FullScreenPlayer.tsx:51-58 が相対値で正しく表示されること
- resumePosition の保存・復元（usePlayer.ts:85,125,162,176,237 は現状絶対時間）との整合を取ること。A-Bリピートとの共存も確認
- start/end なしの通常トラック（1ファイル=1トラック）の挙動は完全に不変であること

server配信（media.ts のバイトRangeストリーミング）は変更しない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 start/end付きトラックの再生時間表示・シークバーがトラック自体の長さ（end-start）基準になる
- [ ] #2 シークバー操作がトラック内で完結し、トラック範囲外へシークできない
- [ ] #3 トラック末尾（end）到達で通常のトラック終了と同じ挙動（次トラック送り等）になる
- [ ] #4 start/endなしのトラックの再生・シーク・レジューム挙動が従来と変わらない
- [ ] #5 レジューム（再生位置の保存・復元）がstart/end付きトラックでも正しい位置に復帰する
- [x] #6 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex(thread 019f76ed-9d8b)が実装。trackTime.ts(相対/絶対変換の純関数)を新設し、usePlayerで currentTime/duration/シーク/A-B/終了検知をトラック相対化。resumePositionは絶対秒のまま互換維持、復元時に区間へクランプ。レビュー指摘（trackEndedRefが再武装されず終端検知が一度きりになる件）も修正済み。ユニットテスト追加、check・test(213件)通過。AC1-5はブラウザ実機確認で検証予定。
<!-- SECTION:NOTES:END -->
