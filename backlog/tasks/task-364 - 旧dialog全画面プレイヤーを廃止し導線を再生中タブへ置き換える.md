---
id: TASK-364
title: 旧dialog全画面プレイヤーを廃止し導線を再生中タブへ置き換える
status: To Do
assignee: []
created_date: '2026-08-21 01:51'
updated_date: '2026-08-21 02:00'
labels: []
dependencies:
  - TASK-363
ordinal: 364000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生中タブの没入モード（TASK-363）が旧<dialog>全画面プレイヤーの役割を吸収するため、旧実装を廃止する。TASK-363完了が前提。後方互換レイヤー・フォールバックは作らない（AGENTS.md方針）。

削除・更新対象（実コードで確認済みの所在）:
- UI: client/src/features/player/ui/FullScreenPlayer.tsx、FullScreenPlayerGate.tsx。これらだけが使う下位部品（FullScreenScrub.tsx等）はrgで使用状況を確認して削除
- 状態: showFullPlayerの正は client/src/entities/player/model/playerCoreState.ts。playerController.ts のinput/reducer/core投影、usePlayerActions.ts のsetShowFullPlayer系、atoms.ts の該当派生を除去
- 配置: AppShell.tsx の fullScreenPlayer 専用slot、App.tsx のGateマウントを除去
- テスト: client/tests/unit/fullScreenPlayer.test.ts は削除、playerDock.test.tsx 等のshowFullPlayerを含むmock・アサーションを更新
- CSS: client/src/styles/shell/player-a.css はファイル削除禁止（bar/popupが現役）。旧fullscreen系のクラス・コメントのみ削除
- 共有コンポーネント PlayerTransportControls.tsx / ABRepeatBar.tsx は再生中タブ用として存続

導線置き換え:
- ポップアップの「全画面へ展開」ボタン（PlayerDock.tsx の onExpandFullScreen 経由）を「再生中タブへ遷移」に置き換える（appMode nowPlayingへの遷移。表示モードはlocalStorageに記憶された最後のモードのまま）。遷移後はnowPlaying中のPlayerDock非描画（TASK-362仕様）によりポップアップが画面に残らないことを確認する
- バー/ポップアップ/キーボードショートカットに全画面dialogを開く導線が残らないこと（rgで確認）

docs更新（追記でなく書き換え）:
- docs/requirements-v4.md: 5.2節（プレイヤーの表示モード）を「バー/ポップアップ/再生中タブ（通常・没入）」へ書き換え。5.2節以外の旧全画面記述もrgで洗い出して更新
- docs/design-system.md: 旧dialog全画面プレイヤーへの言及（z-index一覧等）を更新
- docs/HANDOFF.md: 全画面プレイヤー記述を現状に書き換え

検証:
- smokeテストを追加: 再生開始→ポップアップ→展開ボタン→再生中タブが表示され、旧dialogが存在せず、保存済みの表示モード（normal/immersive）が維持されることを検証

運用: 統合ブランチ feat/now-playing-redesign 配下の作業ブランチ＋worktreeで実施。pnpm test:smoke 必須
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FullScreenPlayer/Gate と showFullPlayer系の状態・アクションが削除されている
- [ ] #2 ポップアップの展開ボタンが再生中タブへの遷移に置き換わり、全画面dialogを開く導線が残っていない
- [ ] #3 旧全画面専用の未使用コード・CSS・ショートカットが残っていない（rgで確認した結果を報告に含める）
- [ ] #4 docs/requirements-v4.md 5.2節と docs/HANDOFF.md が新構成を反映している
- [ ] #5 pnpm check && pnpm test と pnpm test:smoke が全緑
- [ ] #6 再生開始→ポップアップ→展開ボタン→再生中タブ表示・旧dialog非存在・ポップアップ非残存を検証するsmokeテストが追加され通る
<!-- AC:END -->
