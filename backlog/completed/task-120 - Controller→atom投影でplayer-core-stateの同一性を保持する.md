---
id: TASK-120
title: Controller→atom投影でplayer core stateの同一性を保持する
status: Done
assignee: []
created_date: '2026-07-28 16:25'
updated_date: '2026-07-28 17:10'
labels: []
dependencies: []
priority: high
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109 完了後の総合レビュー（GPT-5.6-Sol / Fable の独立2レビュー）で、両者が独立に検出した問題。

問題:
PlayerController.dispatch は audioTimeUpdated で positionSec が変わるたびに state listener を発火し、usePlayer.ts の購読が toPlayerCoreState(state) の戻り値を無条件に playerCoreAtom へ書く。toPlayerCoreState は positionSec を除外するため値は構造的に同一だが毎回新しいオブジェクトを返すので、Jotai（Object.is）は更新として伝播する。

結果、再生中は playerCoreAtom を直接購読する PlayerDock / FullScreenPlayerGate / PlayerRuntime が再レンダリングされ続ける。FullScreenPlayerGate は閉じているときも毎tick動く。atoms.ts が宣言する「playerCoreAtom は低頻度 state」という設計と実装が矛盾している。

実測（Fable、再生中10秒無操作）: PlayerDock 8回 / BarContent 8回 / FullScreenPlayerGate 8回 / App・TopBar・LeftNav・WorkGrid 0回。派生atomがプリミティブを返すため上位への波及はない。agent-browserタブでの計測のため、実利用（timeupdate 約4Hz）ではより高頻度になりうる。

採用する方針（GPT-5.6-Sol 案、Fable も最終確認で同意）:
投影層（controller→atom の橋1箇所）で意味的な同一性を保持する。controller の通知経路は分割しない。

controller 経路分割を採らない理由:
- 「何が core か」を定義しているのは toPlayerCoreState 一箇所。controller で経路を分けるとその分類知識が controller 側にも必要になり、core の定義が2箇所に増える
- subscribeState の本番購読者は usePlayer.ts の1箇所のみ。単一購読者の投影都合を controller API に持ち込むことになる
- PlayerControllerState が再生位置を持つのは正当（A-Bリピートの遷移判断に使う）

R5（派生atomのガード不一致）を隣接修正として同梱する。playingTrackRelPathAtom は currentTrackIndex < 0 のみ、playingTrackTitleAtom は currentWork === null も見る。toPlayerCoreState では両フィールドとも state.item から連動して導出されるため現行コードでは到達不能で実害はないが、片方のガードが冗長という不一致。state.item 連動を前提に currentTrackIndex チェックのみへ揃える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 timeupdate だけでは playerCoreAtom の参照が変わらない
- [x] #2 再生中（無操作）に PlayerDock / FullScreenPlayerGate / PlayerRuntime のレンダー回数が増えない
- [x] #3 時刻を表示する BarContent / PopupContent / FullScreenPlayer は従来どおり更新される
- [x] #4 core フィールドが実際に変わった場合は core 購読者も更新される
- [x] #5 playingTrackRelPathAtom と playingTrackTitleAtom のガードが統一されている
- [x] #6 atoms.ts の設計コメントが実装と一致している
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 投影層（usePlayer.ts の controller.subscribeState 内）で、前回の PlayerCoreState とフィールド単位で比較する。意味的に同じなら既存参照を維持し setCoreState を呼ばない
2. 汎用の深い比較や JSON 比較は使わない
3. 前回値のキャッシュはモジュールグローバルにせず、インスタンス単位（usePlayerRuntime 内の ref 等）に置く。モジュールグローバルだとテストの複数 store 間で干渉する（TASK-109.2 で appModeAtom の初期値がモジュール読み込み時に評価されて同種の問題を起こした前例あり）
4. playerCurrentTimeAtom / playerDurationAtom は従来どおり更新する
5. tracks は state.item が null のとき [] の新規リテラルを返すため、比較方法に注意する
6. R5 のガード統一（playingTrackRelPathAtom を currentTrackIndex チェックのみへ揃える）
7. atoms.ts の設計コメントを実装と一致させる
8. テスト: 時刻 atom の更新と core atom の参照維持を同時に確認する回帰テスト、および PlayerDock 版の退行テスト（R1 が現行の appRootSubscriptions.test.tsx をすり抜けた事実への再発防止）
9. わざと修正前の実装に戻して失敗することを確認する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
投影層（usePlayer.ts の controller.subscribeState 内）で前回の PlayerCoreState と比較し、意味的に同じなら setCoreState を呼ばない形にした。PlayerController の通知 API は変更していない。

比較関数 isPlayerCoreStateEqual は playerController.ts に置いた（toPlayerCoreState が core の定義を持つ場所であり、定義と変更検出を同じ場所に留めるため）。マップドタイプ PlayerCoreComparators で「フィールド名→比較関数」を持たせ、型システムが全キーの存在を要求するので網羅性が保証される。

当初の実装は配列＋as const satisfies readonly (keyof PlayerCoreState)[] で網羅性を担保したつもりだったが、satisfies は配列の場合キー欠落を検出しない（短い配列も代入可能）。スクラッチで実地検証して差し戻した。マップドタイプへ変えたことで型アサーションも5箇所→1箇所に純減。PlayerCoreState に一時フィールドを追加して TS1360 で落ちることを確認済み。

前回値キャッシュは usePlayerRuntime 内の lastCoreStateRef（インスタンス単位）。モジュールグローバルにするとテストの複数 store 間で干渉する。tracks の空配列リテラル問題は EMPTY_TRACKS 定数で解決。

R5 のガード統一: playingTrackTitleAtom から currentWork === null 判定を外し、playingTrackRelPathAtom と揃えて currentTrackIndex のみへ統一。

検証:
- pnpm check 通過、pnpm test 通過（server 340 / client 321、テスト2件追加）
- ビジュアルテスト 6/6、スナップショット差分なし
- 再生中10秒無操作の実測（window.__rc 計装、撤去済み）: PlayerDock 8→0、FullScreenPlayerGate 8→0、PlayerRuntime 0、App/TopBar/LeftNav/WorkGrid 0。BarContent は playerCurrentTimeAtom 購読のため継続更新（28、論理14）で正常
- 陽性対照: 音量変更・トラック切替で PlayerDock が再レンダー（生値2＝論理1）。投影が止まる不具合はない
- ブラウザ実機: プレイヤー操作全般（再生/一時停止/トラック移動/シーク3経路/音量/ミュート復帰/ループ/再生速度/A-Bリピート/チャンネルスワップ）、表示追従（バー・ポップアップ・フルスクリーン・TopBar・LeftNav・ライブラリハイライト・ファイルモードハイライト・has-docked-bar）、再生の完走（自動次トラック・最終トラック停止・レジューム再生）を確認。コンソールエラーなし

退行防止テスト2件追加:
- usePlayer.test.ts: timeupdate で core atom の参照が維持され currentTime のみ更新されること、setVolume では core 参照が変わること
- playerDockSubscriptions.test.tsx: 中間層の観測境界。この問題は App を観測境界とする appRootSubscriptions.test.tsx をすり抜けたため新設
意図的失敗の確認済み（Object.is equality / expected 5 to be 4）
<!-- SECTION:NOTES:END -->
