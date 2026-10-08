---
id: TASK-489
title: 再生開始の準備をplayer側の1つのフックにまとめ、onPlay系propsの受け渡しをなくす
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:47'
updated_date: '2026-10-08 06:44'
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
- [x] #1 再生開始と続きから再生が同じ準備処理を通り、違いは開始位置だけ
- [x] #2 再生開始のコールバックがpropsで画面間を受け渡されていない
- [x] #3 App.tsxに再生準備と鮮度確認の処理が無い
- [x] #4 pnpm check && pnpm test && pnpm test:smoke が通る
- [x] #5 再生要求の鮮度管理がplayerと同じ寿命で全画面に共有され、異なる画面から続けて要求しても古い要求が後から再生を始めないことがテストで縛られている
- [x] #6 準備やキャッシュ更新を待っている間に停止・root再設定が起きたとき、その要求が後から再生を始めないことがテストで縛られている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 現在は App.tsx の playRequestGuard 1つを全画面が共有し、停止とguardの無効化を stopPlaybackAndInvalidateGuard でセットにしている。usePlayerActions の stop 自体はguardを無効化しない。フックごとにuseRefでguardを持つと画面ごとに世代が分かれるので、guardはplayerの共有controller/runtimeと同じ寿命で持ち、stopが未完了の準備要求も無効化するようにする。TASK-488はこの停止契約を呼ぶ側になる。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
再生準備・キャッシュ更新・鮮度確認・失敗トーストを entities/player の requestWorkPlayback/usePlayWork に1本化し、鮮度管理を PlayerController.playRequests（stop・別の再生開始で無効化）に。player の実行系を entities/player/model へ移し、onPlay 系 props の受け渡しと App.tsx の再生処理を撤去。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（server 951 / client 1339）・smoke 30 全通過、fixture でのブラウザ確認（再生・作品編集・スキャン・root 再設定）で崩れ・エラーなし。61e4b7bb で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
