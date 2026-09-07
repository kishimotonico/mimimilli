---
id: TASK-428.16
title: プレイヤーの再生状態・トラックエラー・境界操作を統一する
status: Done
assignee: []
created_date: '2026-09-07 09:08'
updated_date: '2026-09-07 20:32'
labels:
  - ui
  - player
  - error-state
dependencies: []
modified_files:
  - client/src/features/player
parent_task_id: TASK-428
priority: high
ordinal: 443000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
player-A-02/A-03/A-05/A-06/A-09/A-12。一時停止やエラーでも再生中パルスが出て、トラックエラー通知と前後境界の扱いがサーフェスごとに異なる。playing/paused/loading/errorを一つの表示モデルにする。

決定（DRAFT-74 Q-01, 2026-09-07）: 再生速度はポップアップだけでなく再生中タブ（通常モード・没入モードのミニコントロール）でも確認・変更できるようにする。速度ボタンは現在値のラベル（例 1.0×）を常時表示し、前後トラック・再生はアイコンのみとする。ラベルで3操作を区別し、別アイコン方式は採らない。

前提（統合済みの変更）: TASK-428.13 が features/player 配下の操作ボタンへ data-player-control 属性を付与済み。対象は BarContent（前/再生一時停止/次）、PlayerTransportControls（−10/前/再生一時停止/次/+10/ループ/左右チャンネル入替）、PopupContent（−10/+10/速度トリガー/前/再生一時停止/次/ループ）、BarVolumePopover（音量トリガー）、NowPlayingImmersiveMiniControls（前/再生一時停止/次）。意図的に付与していないのは停止・展開・折りたたみ・「再生中の作品を表示」等のナビゲーション系と、ABRepeatBar の A/B地点設定ボタン。この属性を持つ要素にフォーカスがあるときだけ Space がグローバルの再生トグルに回る契約なので、属性を消したり付け替えたりしないこと。docs/design-system.md の「グローバルショートカット / Escape」節に記載がある。

TASK-428.5 が client/src/entities/work/workStatusLabel.ts を新設し、ファイル欠損・メタ読み込みエラーのラベルを grid/list/preview/詳細で共通化済み。トラックエラーの表示を作る際、既存の語彙と矛盾しないようにすること。

TASK-428.2 のトースト契約（action無し5秒 / action付き10秒、hover・focus中は停止、error は手動クローズのみ、variant は info/success/warning/error）に従い、独自のトースト実装やタイマーを作らないこと。GlobalToast の優先順位チェーンは docs と実装を確認すること。

所見IDの対応: 再生速度の決定（Q-01）に対応する所見は player-A-12（速度がポップアップでしか見えない）。player-A-11（ポップアップが右ペインのトラック表を覆う）は本タスクの対象ではなく TASK-430 で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 paused・loading・error中にplaying用パルスを表示しない
- [x] #2 トラックエラーに対象・理由・可能な再試行・閉じる操作を表示する
- [x] #3 前後境界のdisabled状態と理由がバー・popup・再生中一覧で一致する
- [x] #4 再生中一覧のdurationが作品詳細と同じformatterを使う
- [x] #5 pnpm test:smokeに新規失敗がない
- [x] #6 再生速度を再生中タブのミニコントロール（通常・没入）で確認・変更でき、速度ボタンが現在値ラベルを常時表示する
<!-- AC:END -->
