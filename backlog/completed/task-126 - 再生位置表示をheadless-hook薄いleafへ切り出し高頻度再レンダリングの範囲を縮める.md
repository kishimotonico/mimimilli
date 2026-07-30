---
id: TASK-126
title: 再生位置表示をheadless hook+薄いleafへ切り出し高頻度再レンダリングの範囲を縮める
status: Done
assignee: []
created_date: '2026-07-29 18:57'
updated_date: '2026-07-29 19:11'
labels: []
dependencies: []
priority: medium
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
再生中、audio の timeupdate（Chrome で約4Hz / 250ms間隔）ごとに playerCurrentTimeAtom が更新される。TASK-109〜120 の封じ込め自体は正しく機能しており、App / AppShell / PlayerDock / FullScreenPlayerGate / PlayerRuntime / TopBar / LeftNav は再レンダリングされない（高頻度 atom の購読者は BarContent / PopupContent / FullScreenPlayer の3箇所のみ、rg で確認済み）。

問題は頻度ではなく範囲。FullScreenPlayer.tsx:52-53 が高頻度 atom を購読しており、同一コンポーネント内に右ペインのトラックキュー tracks.map（:310-341）を持つ。1トラックあたり button + span×3 なので、100トラックの作品では400要素超が4Hzで再レンダリングされる。BarContent / PopupContent は数十要素で実害は小さく、FullScreenPlayer だけ桁が2つ違う。

atoms.ts:8-9 の設計コメント（この3つのみ subscribe する）は、当時3つが同程度のサイズだという暗黙の前提に依存していた。FullScreenPlayer にトラックキューが乗った時点でその前提が崩れている。

## 方針

「毎秒レンダリングを潰す」ではなく「再レンダリングされる範囲を、実際に時間の関数である DOM だけに縮める」。

headless hook（usePlaybackProgress、useSeekDrag を同梱）+ 面ごとの薄い leaf 3個に切り出す。variant prop の単一コンポーネントは採らない（3面はレイアウトが実際に異なり、Bar はストリップ、FullScreen はツールチップ付き scrub なので分岐が肥大化する）。購読とロジックを hook で共通化し、DOM は各面に残す。

抽出範囲（境界が連続していることを確認済み）:
- BarContent.tsx:124-140（シークストリップが __body の兄弟として独立）
- PopupContent.tsx:201-217（seek ブロックと time-row が連続。time-row も currentTime / duration を直接参照するので必ず含める）
- FullScreenPlayer.tsx:133-171（scrub ブロックと時刻行が連続）

注意: JSX ブロックの移動だけでは不十分で、useAtomValue 呼び出しと派生値計算（pct、ABマーカーの位置 pct、formatTime による時刻表示）をすべて hook / leaf 側へ移すこと。abRepeat は duration のみに依存するので低頻度 props として leaf に渡してよい。FullScreenPlayer 側は抽出後に親へ残る currentTime / duration 依存がゼロになることを確認済み（hasABRepeat は abRepeat のみ依存）。

memo ゼロ設計と相性が良く React.memo は不要。親が購読をやめれば親は再レンダリングされず、leaf は自分の atom 購読で独立更新される。

## 採らない案

- CSS変数 / ref 直書き: 得られるのは十数要素の再レンダリングがゼロになるだけ。store.sub を張った命令的コードと textContent 直書きが必要で、宣言性を捨てる対価に見合わない。本タスク完了後に実測して足りなければ初めて検討する。
- controller 側の間引き（rAF合流・量子化）: positionSec は ABリピート判定（playerController.ts:298）・resume保存・シーク基準に使う正の位置情報で、表示都合をドメインモデルへ侵入させるのは設計悪化。
- 表示側の量子化（playerDisplaySecondAtom = atom(get => Math.floor(get(playerCurrentTimeAtom))) で時刻テキストを4Hz→1Hz化）は有効だが、本タスク完了後に実測してから別途判断する。本タスクには含めない。

## 補足

App.tsx:227-228 の transportBar / fullScreenPlayer は並列スロットで、全画面表示中も PlayerDock 側が消えないため現状は二重に再レンダリングされる。これは leaf 切り出し後に「小さな leaf 2個が並走」へ縮むので追加対処は不要。「全画面中は Dock を消す」といった最適化は行わないこと。

同値判定（isPlayerCoreStateEqual / areTracksEqual）に穴はなく、timeupdate から core が更新される経路は存在しないことを確認済み。ただし areTracksEqual（playerController.ts:67-70）は「参照一致でなければ false」という保守的な契約が名前からもコメントからも読み取れず、将来 tracks を毎回組み立て直すコードが入ると静かに劣化する。本タスクで注記または改名を行う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 再生中、全画面プレイヤーを開いた状態で FullScreenPlayer 本体とトラックキュー（tracks.map）が timeupdate では再レンダリングされない
- [x] #2 BarContent / PopupContent 本体も timeupdate では再レンダリングされず、再レンダリングされるのは切り出した leaf のみである
- [x] #3 上記2件の検証は agent-browser の react renders 計測を使わず、一時計装（レンダー内 console.count）＋陰性・陽性対照、または performance trace で行い、手順と結果を実装ノートに記録している
- [x] #4 シークバーのクリック・ドラッグ（スクラブ）、ホバー時刻ツールチップ、時刻表示、AB区間マーカーの表示が3面すべてで従来どおり動作する
- [x] #5 BarContent / PopupContent / FullScreenPlayer から playerCurrentTimeAtom / playerDurationAtom の直接購読が消えている
- [x] #6 areTracksEqual の「参照一致でなければ false」という契約が、改名または1行コメントでコード上から読み取れる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. model/usePlaybackProgress.ts を新設: playerCurrentTimeAtom/playerDurationAtom を購読し { currentTime, duration, pct } を返す headless hook。
2. leaf を3個新設（ui/配下）:
   - BarSeekStrip.tsx: BarContent.tsx:124-140 のシークストリップを移設。usePlaybackProgress + useSeekDrag を使用。
   - PopupSeek.tsx: PopupContent.tsx:201-217 の seek + time-row を移設。
   - FullScreenScrub.tsx: FullScreenPlayer.tsx:133-171 の scrub + AB マーカー + 時刻行を移設。abRepeat は低頻度 prop として受け取る。
3. BarContent / PopupContent / FullScreenPlayer から playerCurrentTimeAtom/playerDurationAtom の直接購読・useSeekDrag呼び出し・pct等の派生計算を削除し、新leafに置き換える。FullScreenPlayer の hasABRepeat（abRepeatのみ依存）は親に残す。
4. playerController.ts の areTracksEqual に「参照一致でなければfalse」という保守的契約を明示する1行コメントを追加（AC#6）。
5. pnpm check / pnpm test を実行し、フォーマット・型・lint・既存テストを確認。
6. 実測（AC#1-3）は検証担当が別途実施するため対象外。動作確認（AC#4）は目視/簡易確認に留める。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。変更/新規ファイル:
- 新規: model/usePlaybackProgress.ts（headless hook。playerCurrentTimeAtom/playerDurationAtomを購読しcurrentTime/duration/pctを返す）
- 新規: ui/BarSeekStrip.tsx, ui/PopupSeek.tsx, ui/FullScreenScrub.tsx（面ごとの薄いleaf。usePlaybackProgress + 既存useSeekDragを使用）
- 変更: ui/BarContent.tsx, ui/PopupContent.tsx, ui/FullScreenPlayer.tsx（高頻度atomの直接購読・pct等の派生計算・useSeekDrag呼び出しを削除し、対応するleafへ差し替え）
- 変更: model/playerController.ts（areTracksEqualに「参照一致でなければfalse」契約を明示する1行コメント追加、AC#6）
- 変更: model/atoms.ts（購読者が3leafに変わったことをコメント更新）

FullScreenPlayerのhasABRepeat（abRepeatのみ依存）は親に残した。FullScreenScrubはabRepeatを低頻度propとして受け取り、duration(高頻度)と組み合わせてabStartPct/abEndPctを算出。

pnpm check: 全パス（tsc/oxlint/oxfmt）。pnpm test: server 344 pass / client 343 pass、全パス。

AC#5（3コンポーネントから直接購読が消えている）とAC#6（areTracksEqualの契約明示）は自分で確認しチェック済み。AC#1-3（再レンダリング範囲の実測）とAC#4（3面での動作確認）は検証担当に委ねる。

検証担当による実測完了（agent-browser --session task126verify、console.count の一時計装、react renders 計測は不使用）。dev は StrictMode 有効のため実測値は理論値の約2倍。

陰性対照（バー/ポップアップで10秒放置）: BarSeekStrip 17→54 に増加、BarContent は 0 増加。
陽性対照（一時停止＝isPlaying 変化）: BarContent 2 増加で計装が生きていることを確認。
陰性対照（全画面展開中の10秒窓）: FullScreenScrub 102 増加 / PopupSeek 102 増加に対し、FullScreenPlayer 0 増加 / PopupContent 0 増加。
陽性対照（AB地点設定＝abRepeat 変化）: FullScreenPlayer・PopupContent とも 2 増加。

→ トラックキューを含む親3コンポーネントは timeupdate で一切再レンダリングされず、leaf 3個のみが高頻度更新される状態を実測で確認。全画面中に PopupSeek も並走するのはタスク記述どおりの想定内。

AC#4: 3面すべてでクリックシーク・ドラッグ追従・ホバー時刻ツールチップ・時刻表示・AB区間マーカーの動作を確認（スクリーンショット取得済み）。
「採らない案」の混入なし。計装は6ファイルすべてから削除し git diff で痕跡ゼロを確認。pnpm check 全パス、pnpm test は server 344 pass / client 343 pass。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
FullScreenPlayer が高頻度 atom の購読とトラックキュー（tracks.map）を同居させていたため、100トラックなら400要素超が timeupdate 毎（約4Hz）に再レンダリングされていた。headless hook（usePlaybackProgress）と面ごとの薄い leaf 3個（BarSeekStrip / PopupSeek / FullScreenScrub）へ切り出し、BarContent / PopupContent / FullScreenPlayer から高頻度 atom の購読・派生値計算・useSeekDrag を外した。あわせて areTracksEqual の保守的な契約を1行コメントで明示。検証担当が console.count の一時計装＋陽性/陰性対照で親3つの 0 増加と leaf の高頻度更新を実測し、3面の機能維持もブラウザで確認。
<!-- SECTION:FINAL_SUMMARY:END -->
