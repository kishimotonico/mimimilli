---
id: TASK-51
title: 同一ファイル内のトラック切替を再ロードなしのシークに最適化する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-18 21:02'
updated_date: '2026-07-18 21:08'
labels: []
dependencies: []
modified_files:
  - client/src/features/player/model/usePlayer.ts
  - client/tests/unit/usePlayer.test.ts
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
- [x] #1 同一ファイルを指すトラック間の切替（次/前/指定）で音声の再ロードが発生せず、即座に新トラックの先頭から再生される
- [x] #2 異なるファイルへの切替・作品の切替は従来どおりロードされる
- [x] #3 続きから再生（pending resume）・loop・A-Bリピートの挙動が壊れない
- [x] #4 ユニットテストで同一ファイル切替時にengine.loadが呼ばれないことを検証する
- [x] #5 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. usePlayer のロード effect と audioEngine の cleanup・同一URL再設定時の挙動を整理する
2. ロード済みコンテキストに assetUrl を保持し、同一作品・同一assetUrlのトラック移動を seek と atom リセットへ分岐する
3. 仮想終端から同一ファイルの次トラックへ進む場合は pause せず再生を継続する
4. 同一ファイルと異なるファイルの切替テストを追加する
5. pnpm check と pnpm test で検証する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
調査結果: engine.load が返す cleanup は pending seek 用の loadedmetadata/canplay リスナーだけを解除し、Audio 要素や src は破棄しない。Audio 要素全体の破棄は engine.destroy の寿命で行われる。同一URLでも load は audio.src を再設定するため、再ロードとバッファ・再生位置のリセットが発生する。
実装判断: ロード済みコンテキストに解決済み assetUrl を保持し、トラック番号が変わり、かつ workId と assetUrl が一致するときだけ seek 経路へ分岐した。pending resume を開始位置より優先し、resume保存、atom、trackEndedRef、A-B解除の既存経路を維持した。仮想終端から同一アセットへ進む場合は pause しない。
検証: pnpm check 成功。pnpm test 成功（server 20件、client 226件）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
同一作品・同一assetUrlのトラック切替を再ロードなしのseekへ変更した。再生中・一時停止中・仮想終端・pending resumeを含むテストを追加し、異なるファイルと別作品は従来どおり再ロードされることを確認した。pnpm check と pnpm test は成功。
<!-- SECTION:FINAL_SUMMARY:END -->
