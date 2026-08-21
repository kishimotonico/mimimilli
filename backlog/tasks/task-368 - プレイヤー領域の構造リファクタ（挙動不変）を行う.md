---
id: TASK-368
title: プレイヤー領域の構造リファクタ（挙動不変）を行う
status: Done
assignee:
  - '@fable'
created_date: '2026-08-21 08:01'
updated_date: '2026-08-21 08:53'
labels: []
dependencies: []
ordinal: 368000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生UI改修6タスクの反復で溜まった構造的負債の整理。Codex品質レビューとSonnet点検の結果に基づく。すべて挙動不変の純リファクタで、表示・操作・localStorageキー・テストの保証内容を変えないこと。

作業項目:
1. entity層のUI/shell状態を features へ移動: client/src/entities/player/model/atoms.ts にある playerUiModeAtom・playerPopupOffsetAtom・nowPlayingViewModeAtom 等のプレゼンテーション状態を features/player/model/playerPresentationAtoms.ts（新設）へ一括移動。appModeAtom を知っている dockedBarActiveAtom（atoms.ts:60付近）の合成はapp/shell側へ移す。core・progress・再生対象selectorはentityに残す。atomの一時的な二重定義は別stateになるため禁止（import一括更新で移動）。localStorageキーは変更しない
2. 没入idleの一元化: useImmersiveIdle の呼び出しを NowPlayingImmersive 親の1箇所に統合し、NowPlayingImmersiveMiniControls へは表示用idle値をpropsで渡す（window listener・timerの二重化を解消）。reset規則は現行維持（トラック切替でタイトル・切替アイコンは再表示、ミニコントロールは再表示しない）。ミニコントロールのidleフェード動作のunitテストを追加
3. 型・初期値の一本化: PlaybackStatus / PlayerCoreState / PlaybackTrack / PLAYER_CORE_INITIAL がentity（playerCoreState.ts）とfeature（playerController.ts）に重複している。entityを正としてfeatureの透過re-exportを削除。AB区間の型と a<b 成立判定も同じ場所へ集約
4. active再生状態のview model化: active判定（work/file＋trackIndex存在のみでtracks範囲を保証しない）に対し、成立済み状態を返すderived view modelまたはtype guardをentity/modelへ追加し、NowPlayingView等の currentWork! や track?.title ?? "—" といったnon-null assertion・防御表示を削減（表示結果は不変）。core state全体の判別共用体化はしない
5. ミニコントロールの削除境界の整合: NowPlayingImmersiveMiniControls の専用CSS（player-a.css:907付近）をコンポーネントの所有単位に寄せ、冒頭の削除手順コメントを実態（import・JSX・props・CSS）に合わせて修正
6. player-a.css（932行）の分割: player-dock / player-popup / now-playing / now-playing-immersive の所有者単位4ファイルへ分割。カスケード順（基底規則→修飾子）を維持し、見た目が変わらないことを実機確認。.mle-nowplaying__controls の first-child/last-child 依存には役割classを付与。.mle-icbtn.is-on / .is-muted はrgで使用実態を確認し、未使用と確証が取れたもののみ削除（ミュートボタン自体の撤去はTASK-369の担当なので混ぜない）
7. 未使用経路の削除: playerController.ts の seekRelativeRequested と AudioEngine.seekRelative はproduction未参照（usePlayerActionsが絶対位置変換している）。現行の絶対seekを正として削除。controller相対seekへの置き換えはしない
8. 小粒の共通化: clamp相当の3箇所（trackTime.ts / usePopupDrag.ts / useSeekDrag.ts）を shared/lib の1実装へ。ratioFromClientX（useSeekDrag.ts / useABHandleDrag.ts で同一実装）を共通ヘルパーへ
9. テストfixture: PlayerDockの必須propsを渡していないテスト（playerDock.test.tsx:65等）向けに小さなfixture builderを導入し、型どおりのprops生成に統一

運用: masterからブランチを切り .worktrees/<タスクID> で作業。1〜9は独立性が高いのでコミットを分けること。UIに触るためpnpm test:smoke必須。TASK-369より先に完了させる
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 UI/shell系atomがfeatures/playerへ移動し、entities/playerにはcore・progress・selectorのみが残る（レイヤー境界検査通過）
- [x] #2 useImmersiveIdleの呼び出しが親1箇所になり、ミニコントロールのidleフェード（reset規則含む）がテストで検証されている
- [x] #3 再生状態の型・初期値・AB判定がentityに一本化され、featureの重複定義・透過re-exportが削除されている
- [x] #4 player-a.cssが所有者単位の4ファイルに分割され、実機確認で見た目の変化がない
- [x] #5 seekRelativeの未使用経路が削除され、clamp・ratioFromClientXが共通化されている
- [x] #6 既存の全テストが修正なしで通る挙動不変が保たれている（テスト変更はfixture導入・idleテスト追加のみ）
- [x] #7 pnpm check && pnpm test と pnpm test:smoke が全緑
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
検証メモ: 480px幅でトランスポート行がはみ出すのは対応なしと判断（サポート下限はTASK-366で定めた1024px。CSSセレクタ等価性のレビュー確認によりmaster時点からの既存状態で、本リファクタ起因ではない）
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
プレイヤー領域の構造的負債を9項目の純リファクタで整理（8コミット）。UI/shell atomのfeatures移動（dockedBarActiveはplayerDockBarVisibleAtom＋shell合成へ分解、props配布＋結合テスト）、没入idleの親一元化（reset規則維持＋unitテスト）、型・初期値・AB判定のentity一本化、active view model化、player-a.cssの所有者単位4分割（未使用.mle-icbtn.is-on/.is-muted削除、役割class化）、seekRelative未使用経路削除、clamp/ratioFromClientX共通化、PlayerDockテストfixture導入。挙動不変はレビューで式レベルの等価性確認＋実機で見た目・localStorageキー不変確認。pnpm check / pnpm test / pnpm test:smoke 全緑。masterへ--no-ffマージ済み
<!-- SECTION:FINAL_SUMMARY:END -->
