---
id: TASK-53
title: 作品を聴き終えたときにレジューム位置をリセットする
status: Done
assignee:
  - '@codex'
created_date: '2026-07-18 21:03'
updated_date: '2026-07-18 21:20'
labels: []
dependencies: []
modified_files:
  - client/src/features/player/model/usePlayer.ts
  - client/tests/unit/usePlayer.test.ts
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在、最終トラックの終端まで再生すると finishCurrentTrack が resumePosition をトラック終端（絶対秒）で保存したままにする。次に「続きから再生」すると終端から始まってすぐ止まる。TASK-50以前からある挙動。

対応: 最終トラックを聴き終えた（loop無効で次トラックが無い）場合は、レジューム情報を先頭に戻す（resumePosition=0、resumeTrackIndex=0）。途中トラックの終端→次トラック送りの場合は従来どおり。サーバーAPI（saveResumePosition）の仕様変更が必要かも含めて調査すること。

関連: client/src/features/player/model/usePlayer.ts の finishCurrentTrack、server/src/routes/works.ts の resume エンドポイント。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 最終トラックを聴き終えた作品を「続きから再生」すると先頭（トラック1の0秒）から再生される
- [x] #2 途中トラック終端での次トラック送り時のレジューム保存は従来どおり
- [x] #3 ユニットテストで聴了時のリセット挙動を検証する
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. finishCurrentTrack、saveResumePosition、resume API、playWithResume、保存effectの実行順序を確認する
2. 最終トラック聴了時だけレジュームを0/0へリセットし、後続effectによる上書きを防ぐ
3. 最終聴了・途中トラック送り・聴了後の上書き防止をユニットテストで検証する
4. pnpm check と pnpm test を実行し、受け入れ条件と完了情報を更新する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
調査: resumePosition はファイル内の絶対秒、resumeTrackIndex はプレイリスト内のトラック番号として保存・復元される。resume API のスキーマは position=0 / trackIndex=0 を受理するため、server変更は不要。聴了時は finishCurrentTrack の保存後に isPlaying=false となり、一時停止保存effectが終端を再保存する経路があった。effect後始末前の5秒保存も trackEndedRef で抑止した。

実装: 最終トラック聴了時だけ0/0を保存し、途中トラックでは従来の絶対終端を保存する。playWithResume はresumePosition=0のときpendingResumeを明示的に消す。最終聴了、途中送り、聴了後上書き防止のユニットテストを追加。検証: pnpm check、pnpm test（server 20件、client 233件）成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
最終トラック聴了時のレジュームを先頭（position=0、trackIndex=0）へ戻し、聴了後の一時停止・定期保存による終端位置の上書きを防止した。途中トラックの保存形式は維持し、ユニットテストと全check/testで確認済み。
<!-- SECTION:FINAL_SUMMARY:END -->
