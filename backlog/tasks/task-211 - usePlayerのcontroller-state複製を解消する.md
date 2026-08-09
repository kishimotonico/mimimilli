---
id: TASK-211
title: usePlayerのcontroller state複製を解消する
status: To Do
assignee: []
created_date: '2026-08-06 04:59'
updated_date: '2026-08-09 14:31'
labels: []
dependencies: []
priority: medium
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/player/model/usePlayer.ts:158 が runtimeRefs.coreState.current.playbackRate を参照しており、playerController が持つ状態とは別に runtime ref へ複製した値を読む構造になっている。同期コマンドが古い playbackRate を読む可能性がある。

出典: backlog/docs/doc-3（設計レビュー 2026-07-30、Codex指摘#26）。当時は「実害の再現経路を確認できておらず、修正はプレイヤー中核に触るためリスクの割に益が薄い」として起票せずに見送られた。つまりリスクとコストを理由にした見送りであり、AGENTS.md の「工数がかかっても本質的に改善する」という方針に照らせば本来やるべきだったもの。

プレイヤー領域は TASK-92 / TASK-110 / TASK-112 / TASK-128 / TASK-143 と「状態の二重管理・タイミング競合」に起因する不具合を繰り返し出してきた場所であり、同型のパターン（複製された状態の読み取りずれ）が残っている限り同系統の再発リスクが続く。

## 方針

doc-3 のメモどおり、複製された ref ではなく controller.getState() を直接参照する形へ寄せる。ほかにも controller の状態を ref へ複製して読んでいる箇所がないか、player 配下を洗ってから着手すること。

再現経路が確認できていないため、まず「古い値を読む状況が実際に起こりうるか」を調べ、起こりうるなら再現テストを書いてから直すこと。起こり得ないと結論づけた場合は、その根拠を報告し、それでも構造として複製をやめるかを判断する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 usePlayer が playbackRate をはじめとする controller の状態を、ref への複製ではなく controller から直接取得している
- [x] #2 player 配下に同種の「controller 状態を ref へ複製して読む」箇所が他に残っていない（残す判断をした場合は理由が記録されている）
- [x] #3 古い値を読む状況が再現可能なら退行テストが追加されている。再現不能と結論づけた場合はその根拠が記録されている
- [x] #4 再生・一時停止・トラック切替・シーク・再生速度変更が従来どおり動作する
- [x] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
