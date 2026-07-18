---
id: TASK-53
title: 作品を聴き終えたときにレジューム位置をリセットする
status: To Do
assignee: []
created_date: '2026-07-18 21:03'
labels: []
dependencies: []
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
- [ ] #1 最終トラックを聴き終えた作品を「続きから再生」すると先頭（トラック1の0秒）から再生される
- [ ] #2 途中トラック終端での次トラック送り時のレジューム保存は従来どおり
- [ ] #3 ユニットテストで聴了時のリセット挙動を検証する
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
