---
id: TASK-51
title: 同一ファイル内のトラック切替を再ロードなしのシークに最適化する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-18 21:02'
updated_date: '2026-07-18 21:03'
labels: []
dependencies: []
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在の usePlayer のロードeffectは、トラックが変わるたびに engine.load(assetUrl) で音声を読み込み直す。区間トラック（1ファイル内のstart/end区間、TASK-50で相対時間再生に対応済み）同士の切替でも同じファイルを再ロードしており、大きいファイルだと切替のたびにロード待ちが発生する。

対応: 切替前後で同一作品かつ同一ファイル（同じassetUrl）を指す場合は engine.load をスキップし、新トラックの開始位置へのシーク＋状態リセット（currentTime/durationのatom更新、trackEndedRefリセット等）だけで切り替える。切替が即時になり、ほぼギャップレスになる。

注意点: pending resume（続きから再生）のシーク処理、再生中/一時停止中それぞれの切替、loop・A-Bリピートとの整合、cleanup（engine.loadが返すcleanupの寿命）の扱い。関連: client/src/features/player/model/usePlayer.ts のロードeffect、audioEngine.ts の load/seek。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 同一ファイルを指すトラック間の切替（次/前/指定）で音声の再ロードが発生せず、即座に新トラックの先頭から再生される
- [ ] #2 異なるファイルへの切替・作品の切替は従来どおりロードされる
- [ ] #3 続きから再生（pending resume）・loop・A-Bリピートの挙動が壊れない
- [ ] #4 ユニットテストで同一ファイル切替時にengine.loadが呼ばれないことを検証する
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
