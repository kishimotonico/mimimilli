---
id: TASK-278
title: playerランタイムの過剰抽象を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
updated_date: '2026-08-09 14:39'
labels: []
dependencies: []
priority: medium
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した player の抽象コスト。Codexレビュー反映で範囲を修正。
- playerRuntimeCapabilities.ts:17-37 のレジストリは2関数のためだけに存在するが、未mount時fail-fast・unmount時解除・StrictModeのstale cleanup防止というライフサイクル契約を持つ（playerRuntimeCapabilities.test.ts）。PlayerRuntimeContext へ統合する場合はこの契約を維持し、同等のテストを移す
- usePlayerActions.ts:81-84 stop() が controller dispatch 後に runtimeRefs.loadedTrack.current = null を命令的に変更。現在は resume保存→pause→seek の後に解放される順序（playerController.ts:238-255）なので、解放を明示的な後段処理として定義し、保存・停止・seek・ref解放の順序をテストで固定する
- atoms.ts:28 playerIsPlaybackActiveAtom は loading を含むのに「再生中」を連想させる名前 → 実態に合う名前へ変更
- 当初挙げた usePlayerState の削除は撤回（1行でもUIをJotai実装から隔離する意味的な購読API。境界として維持）
controller + Jotai の二重投影はperf分離として意図的なので維持する。usePlayerのcontroller state複製はTASK-211の担当なので、着手順を統括と調整する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 clientのcheck・playerのテストが通ること
- [x] #2 capabilitiesレジストリの置き換え後も、未mount時fail-fast・unmount解除・StrictMode対応の契約がテストで維持されていること
- [x] #3 stop時の保存・停止・seek・ref解放の順序が明示的に定義され、テストで固定されていること
- [x] #4 誤解を招く命名（playerIsPlaybackActiveAtom）が実態に合う名前になっていること
<!-- AC:END -->
