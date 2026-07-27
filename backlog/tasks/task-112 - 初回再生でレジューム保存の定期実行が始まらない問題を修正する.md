---
id: TASK-112
title: 初回再生でレジューム保存の定期実行が始まらない問題を修正する
status: To Do
assignee: []
created_date: '2026-07-27 01:57'
labels:
  - client
  - player
  - bug
dependencies: []
priority: medium
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で発見。コード上は確定、実機での再現確認は未実施。

usePlayer.ts:150 の 5秒間隔 persistTick の effect が、ガードと依存配列で異なる条件を見ている:
- ガード: controller.getState().status !== "playing" なら早期 return
- 依存配列: [controller, coreState.isPlaying, coreState.currentTrackIndex]
- playerController.ts:292 で isPlaying = (status === "playing" || status === "loading")

初回ロード時は status が loading の段階で isPlaying が false → true に変わって effect が走り、ガードで即 return する。その後 loading → playing へ遷移しても isPlaying は true のままで currentTrackIndex も変わらないため effect は再実行されず、interval が張られない。一度 pause / resume するまで5秒ごとのレジューム保存が始まらない。

修正の方向:
- ガードと依存配列の条件を揃える（status を直接見る派生値を coreState に持たせるか、controller の購読で扱う）
- 「isPlaying が loading を含む」という定義自体が誤解を招くので、命名や分割も検討する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 初回再生の開始直後から5秒間隔のレジューム保存が動作する
- [ ] #2 一時停止中はレジューム保存の定期実行が止まる
- [ ] #3 ガードの条件と依存配列の条件が一致している
- [ ] #4 再生位置の復元（続きから再生）が従来どおり動作する
<!-- AC:END -->
