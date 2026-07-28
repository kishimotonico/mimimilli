---
id: TASK-121
title: PlayerRuntimeの遅延能力を明示登録しref更新をpost-commitにする
status: To Do
assignee: []
created_date: '2026-07-28 16:26'
updated_date: '2026-07-28 16:26'
labels: []
dependencies:
  - TASK-120
priority: high
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109 完了後の総合レビュー（Fable が検出、GPT-5.6-Sol が対処方針を精緻化）。

問題1: silent no-op（AGENTS.md の「過度なフォールバック禁止・問題を隠蔽しない」に抵触）
- usePlayer.ts の playWithResume は loadResumeRef.current が null なら黙って return
- seek は getCurrentPlaybackContextRef.current() が null なら黙って return（初期値は PlayerRuntimeProvider の () => null）

usePlayerActions は <PlayerRuntime /> がマウントされ usePlayerRuntime がレンダーされて初めて機能する。この配線が切れても（overlays から PlayerRuntime を外す、テストで入れ忘れる等）型検査もレンダーも通り、再生・レジューム・シークだけが黙って失敗する。通常フローでは踏まないが、防御が「たまたま踏まない」に依存している。

問題2: レンダー中の ref 代入が4箇所（usePlayer.ts）。StrictMode の二重レンダーでは冪等で無害だが、正攻法は post-commit での代入。

採用する方針（GPT-5.6-Sol 案、Fable も最終確認で同意）:
Provider が所有する小さな PlayerRuntimeCapabilities registry にする。PlayerController には持たせない。

controller へ寄せない理由:
controller は状態遷移とコマンド通知の境界であり、DB由来のレジューム処理や AudioEngine の実行能力まで持たせると責務が混ざる（サービスロケータ化の芽）。engine / loadedTrack / pendingResume など runtime 内部の可変状態は ref のままでよく、神クラス化しない。

非ブロッキングの追加検討（Fable 提案）:
lastVolume（ミュート前音量）は I/O のない純粋な状態遷移なので reducer 行きが自然。本タスクのついでに検討してよい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PlayerRuntime をマウントせずに playWithResume / seek を呼ぶと、黙って失敗せず throw する
- [ ] #2 未登録（配線バグ）と、登録済みだが再生対象がないため null（正常）が厳密に区別されている
- [ ] #3 レンダー中の ref 代入が解消されている
- [ ] #4 再生・レジューム・シーク・MediaSession が従来どおり動作する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. loadResume と getCurrentPlaybackContext を1組の capabilities として登録する仕組みを作る。登録先は Provider 所有の小さな registry（PlayerController には持たせない）
2. register(capabilities) は cleanup を返す
3. 未登録時の利用は開発環境限定ではなく常に throw する（dev限定 throw は AGENTS.md の「その場しのぎ」に該当するため不可）
4. 「未登録＝配線バグ＝throw」と「再生対象なし＝正常 no-op」を厳密に区別する。既存の if (!resume) return; は後者なので維持する
5. レンダー中の ref 代入4箇所を useLayoutEffect 等の post-commit へ移す
6. StrictMode の古い cleanup が新しい登録を解除しないよう、登録トークンか同一性ガードを設ける
7. engine / loadedTrack / pendingResume など runtime 内部の可変状態は現状の責務に残す
8. 任意: lastVolume を reducer へ移すことを検討する（非ブロッキング）
9. テスト: capabilities の未登録と「再生対象なし」を区別するテスト、StrictMode の登録・解除と stale cleanup のテスト
<!-- SECTION:PLAN:END -->
