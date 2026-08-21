---
id: TASK-364
title: 旧dialog全画面プレイヤーを廃止し導線を再生中タブへ置き換える
status: Done
assignee:
  - '@fable'
created_date: '2026-08-21 01:51'
updated_date: '2026-08-21 04:12'
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
- [x] #1 FullScreenPlayer/Gate と showFullPlayer系の状態・アクションが削除されている
- [x] #2 ポップアップの展開ボタンが再生中タブへの遷移に置き換わり、全画面dialogを開く導線が残っていない
- [x] #3 旧全画面専用の未使用コード・CSS・ショートカットが残っていない（rgで確認した結果を報告に含める）
- [x] #4 docs/requirements-v4.md 5.2節と docs/HANDOFF.md が新構成を反映している
- [x] #5 pnpm check && pnpm test と pnpm test:smoke が全緑
- [x] #6 再生開始→ポップアップ→展開ボタン→再生中タブ表示・旧dialog非存在・ポップアップ非残存を検証するsmokeテストが追加され通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装6012607＋smoke a1cae08＋docs f3bb7ab/8d7e5bb。レビュー（Sonnet）blockerなし、:modalガード撤去の論拠も検証済み。requirements-v4のポップアップ位置固定の陳腐化記述も修正。check/test(822)/smoke(20)全緑。feat/now-playing-redesignへff取り込み済み

Codex最終レビューの3指摘（トラックリスト内部スクロール不能・popstate経由のモーダル共存でEsc誤爆・没入解除時フォーカス消失）は全て実在バグと裏取りし6767986で修正。:modalガードは撤去から復活に転じた（popstateがinertを経由せずappModeを書き換える反例経路のため）。回帰ガードsmoke2件を7eaeea7で追加、check/test(823)/smoke(22)全緑
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
旧dialog全画面プレイヤーと showFullPlayer系状態を全廃し、ポップアップの展開導線を再生中タブ遷移へ一本化（6012607〜8d7e5bb、-582行）。:modalガードは共存経路消滅によりdead code化のため撤去。docs3本を新構成へ書き換え、遷移smoke追加。check/test/smoke全緑
<!-- SECTION:FINAL_SUMMARY:END -->
