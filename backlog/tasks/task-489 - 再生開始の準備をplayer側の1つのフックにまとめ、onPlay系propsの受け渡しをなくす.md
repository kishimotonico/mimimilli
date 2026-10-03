---
id: TASK-489
title: 再生開始の準備をplayer側の1つのフックにまとめ、onPlay系propsの受け渡しをなくす
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
labels:
  - client
  - player
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 547000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
App.tsx の handlePlay と handleResume は、prepareWorkPlayback→updateCachesAfterPlaybackPrepared→playRequestGuardによる鮮度確認2回→エラートースト（isRootReconfiguringErrorは除外）までがほぼ同じで、最後の player.play と player.playWithResume だけが違う。onPlay/onResume/onTogglePlay は AppBody→LibraryView→LibraryResultsPane/PreviewPane→WorkDetail→WorkPlayButton など、library・files・playerの十数ファイルを経由して渡されている。再生準備・鮮度確認・失敗時の表示をplayer側のフック（例 usePlayWork）かplayerControllerのコマンドに1本化してguardも同居させ、各画面はpropsを受けずに直接呼ぶ。App.tsxは再設定時にplayerのstopを呼ぶだけにする。詳細は doc-7 の cli-arch-5。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生開始と続きから再生が同じ準備処理を通り、違いは開始位置だけ
- [ ] #2 再生開始のコールバックがpropsで画面間を受け渡されていない
- [ ] #3 App.tsxに再生準備と鮮度確認の処理が無い
- [ ] #4 古い再生要求が後から来た要求を上書きしないことがテストで縛られている
- [ ] #5 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->
