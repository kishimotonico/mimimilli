---
id: TASK-278
title: playerランタイムの過剰抽象を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:21'
labels: []
dependencies: []
priority: medium
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出した player の抽象コスト。
- playerRuntimeCapabilities.ts:17-37 の register/require レジストリは loadResume と getCurrentPlaybackContext の2関数のためだけに存在 → PlayerRuntimeContext に直接載せてレジストリを廃止
- usePlayerActions.ts:81-84 stop() が controller dispatch 後に runtimeRefs.loadedTrack.current = null を命令的に変更 → stopRequested の処理内で lifecycle が cleanup する形へ統一
- usePlayerState.ts:5-9 型alias+1行 useAtomValue ラッパーのみ → atoms.ts 直接利用に統一
- atoms.ts:28 playerIsPlaybackActiveAtom は loading を含むのに「再生中」を連想させる名前 → 実態に合う名前へ変更
controller + Jotai の二重投影自体はperf分離として意図的なので維持する。usePlayerのcontroller state複製はTASK-211の担当なので、着手順を統括と調整する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 capabilities レジストリが廃止され、直接参照になっていること
- [ ] #2 stop時のクリーンアップが lifecycle 側に一元化されていること
- [ ] #3 薄いラッパー・誤解を招く命名が解消されていること
- [ ] #4 clientのcheck・playerのテストが通ること
<!-- AC:END -->
