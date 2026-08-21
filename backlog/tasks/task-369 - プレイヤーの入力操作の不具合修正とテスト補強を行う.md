---
id: TASK-369
title: プレイヤーの入力操作の不具合修正とテスト補強を行う
status: Done
assignee:
  - '@fable'
created_date: '2026-08-21 08:01'
updated_date: '2026-08-21 09:47'
labels: []
dependencies:
  - TASK-368
ordinal: 369000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex品質レビューで見つかった実害のある挙動問題の修正と、テストの欠落補強・低価値テスト整理。TASK-368（構造リファクタ）の完了後に着手する。

作業項目:
1. グローバルショートカットの除外拡大: useGlobalShortcuts.ts:24付近はINPUT/TEXTAREA/contentEditableしか除外しておらず、button・link・select・sliderへフォーカス中でもSpace/矢印をpreventDefaultして再生・シークに変換してしまう。`button, a, input, textarea, select, [role="slider"], [contenteditable]` を対象外にする共通判定に変更
2. ポインタージェスチャーのcancel処理: useSeekDrag / useABHandleDrag の終了処理がpointerupのみで、pointercancel・lostpointercaptureを扱わずドラッグ状態が固まり得る。冪等な終了処理へ両イベントを接続（releasePointerCaptureによるlostイベントとの二重発火を安全に処理）。TASK-368で共通化したprimitiveに実装
3. 没入モードのinert整合: useNowPlayingImmersiveShell が兄弟要素のinertをcleanupで無条件削除し、没入前からinertだった要素の状態を破壊する。開始時状態を保存して復元する方式へ。あわせてidle時に不可視化されるミニコントロール（aria-hidden＋pointer-events:noneだがTab順に残る）へinertを適用し、表示とフォーカス可否を同期する（キー操作はactivity扱いで復帰表示される既存挙動は維持）
4. Popupのミュートボタン撤去: BarVolumePopoverの設計判断（音量スライダーで足りる）を正とし、PopupContentのミュートボタンと onToggleMute 配線を削除して全ビューで統一。不要になったCSS修飾子（.mle-icbtn.is-muted等）も削除
5. テスト補強: (a) 1024px幅のplayer専用smokeを追加（TASK-366の2段コントロール構成が現状1440×960のみで未カバー） (b) NowPlayingScrubのAB区間表示・角括弧ハンドル操作のunitテスト追加 (c) PopupContentの利用者操作テスト追加
6. 低価値テストの整理: playerDockSubscriptions.test.tsx は実PlayerDockでなくusePlayerState observerを測定しておりusePlayer.test.ts:830付近と実質重複。atom参照同一性テストへ一本化するか実PlayerDock描画の測定に置き換え、実際には保証していない性能テストを残さない
7. dialog不在smokeのassert狭め: 旧全画面プレイヤー廃止を検証するsmokeの「dialogが存在しない」条件が広すぎる（将来の正当なdialogで誤検知する）。旧player固有の正方向assertへ狭める

運用: masterからブランチを切り .worktrees/<タスクID> で作業。挙動変更を含むため実機確認必須（agent-browser、フィクスチャ）。pnpm test:smoke必須
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ボタン・リンク・select・sliderへフォーカス中はSpace/矢印がネイティブ動作のままで、それ以外では従来どおりショートカットが効く
- [x] #2 シーク・ABハンドルのドラッグ中にpointercancelが起きてもdragging状態が残らない
- [x] #3 没入モードの出入りで既存のinert状態が破壊されず、idle時の不可視ミニコントロールへTabフォーカスが入らない
- [x] #4 Popupのミュートボタンが撤去され、関連する未使用配線・CSSが残っていない
- [x] #5 1024px幅のplayer smoke・NowPlayingScrubのAB unit・PopupContent操作テストが追加され、低価値な購読性能テストが整理されている
- [x] #6 pnpm check && pnpm test と pnpm test:smoke が全緑
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
プレイヤー入力操作の実害不具合4件を修正しテストを補強（6コミット）。グローバルショートカットの除外をbutton/a/input/textarea/select/[contenteditable]へ拡大（[role=slider]はArrow系・Home/Endのみ除外、Spaceはグローバルトグル維持でスクロール副作用を回避）。シーク・ABハンドルへpointercancel/lostpointercaptureの冪等な終了処理を接続。没入モードのinertを保存復元方式にし、idle時ミニコントロールへinert適用で表示とフォーカス可否を同期。Popupミュートボタンと配線を完全撤去。1024px smoke・Scrub AB unit・PopupContent操作・ショートカット除外のテスト追加、低価値な購読性能テストをatom参照同一性テストへ一本化、dialog不在smokeのassertを.mle-nowplaying配下へ縮小。check/test（server671+client845）/smoke23件全緑、実機検証・レビュー通過。masterへ--no-ffマージ済み
<!-- SECTION:FINAL_SUMMARY:END -->
