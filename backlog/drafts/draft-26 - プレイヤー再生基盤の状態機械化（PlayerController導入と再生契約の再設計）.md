---
id: DRAFT-26
title: プレイヤー再生基盤の状態機械化（PlayerController導入と再生契約の再設計）
status: Draft
assignee: []
created_date: '2026-07-19 03:09'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘3,4,5,6,7,21の統合構想。キュー・ギャップレス・プリロード・作品横断プレイリストを実装する前が最後の安い移行時期という判断。裏取り済み（全指摘「事実」判定）。

含まれる要素:
- React外にPlayerControllerを置き、idle/loading/playing/paused/ended/error と再生項目を明示したreducer/state machineにする。React・Audio・永続化・MediaSessionはイベントとコマンドで接続（現状はatom+ref+effectの暗黙協調。atoms.ts/usePlayer.ts/useAudioEngineLifecycle.ts/playerRuntime.ts に拡散）
- resume契約の再設計: 現状は{trackIndex, ファイル絶対秒}で、トラック並べ替え・区間変更・ファイル差し替えで意味が変わり、サーバーは無条件上書き（workRepo.ts saveResume）。playlist/trackに安定IDを導入し、{playlistId, trackId, offsetSec, revision}へ。関連: DRAFT-22（デバイス間引き継ぎ）
- Track/Playlistスキーマの不変条件（end>start、区間重複ポリシー、トラックID）をZod superRefineで定義（shared/src/work.ts）
- 「聴了」をドメインイベントとして定義（現状は渡されたtracks配列の末尾=聴了で、Filesモードや将来のキュー・部分再生と矛盾。PlaybackQueue終了とWorkCompletionの分離）
- 絶対秒/トラック相対秒のbranded type化（trackTime.ts。AudioEngine境界だけが絶対秒を扱う）
- プレイヤーテストの再構成（756行のusePlayer.test.tsが内部イベント順序に結合。PlayerControllerのシナリオテスト+HTMLAudio adapterの契約テストへ分離）

着手時はまず「要件を決めるタスク」を切り、state machineの状態・イベント一覧とresume契約のマイグレーション方針を固めること。
<!-- SECTION:DESCRIPTION:END -->
