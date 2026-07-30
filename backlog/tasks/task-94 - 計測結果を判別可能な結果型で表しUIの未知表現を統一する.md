---
id: TASK-94
title: 計測結果を判別可能な結果型で表しUIの未知表現を統一する
status: To Do
assignee: []
created_date: '2026-07-25 10:27'
updated_date: '2026-07-30 12:35'
labels: []
dependencies: []
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-91/92と同型の『未知を暗黙の値で埋める』残渣を根本から断つ。現状3つの問題が絡んでいる。(1) 仕様乖離: TASK-92のImplementation Notesは『probe結果を内部で区別: 正の有限値/ファイル欠損/非対応・解析失敗/キャッシュ未取得』と定めたが、実装(server/src/adapters/real/probe.ts)は全ての失敗モードをnullへ潰しており、DTOから『まだ計測していない』と『ファイルが壊れている』を区別できない。ユーザーは待てばよいのか対処が要るのか判断できない。(2) 二重管理: 不正start(start>=ファイル全体長)の判定が shared の resolveTrackDurationSec と server/src/adapters/real/scanner.ts の両方に別々に書かれており、片方だけ直すと静かに乖離する。実際この重複が原因でend指定トラックの不正startを取りこぼす欠陥が発生した。(3) 方針違反: client/src/shared/lib/format.ts の formatTime が 0・NaN・Infinity をすべて '0:00' に潰しており、TASK-92でDTOと呼び出し側を null→'--:--' に統一した方針がフォーマッタ層で破られている。加えて同じdurationSecの丸めが画面間で不一致(WorkTrackListはMath.round、プレイヤーは切り捨て)で、906.6秒が一覧15:07・プレイヤー15:06と食い違う。共通の判別可能な結果型を導入して(1)(2)を同時に解決し、フォーマッタを整理して(3)を解消する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 計測結果が判別可能な結果型で表現され、少なくとも『解決済み』『未計測』『解析失敗・非対応』『ファイル欠損』『データ不正(start>=ファイル長)』を呼び出し側が区別できる
- [ ] #2 不正startの判定ロジックが1箇所に集約され、scannerとshared双方に同じ条件が重複実装されていない
- [ ] #3 UIが『未計測』と『計測失敗』を区別して提示し、いずれも0:00と表示しない
- [ ] #4 formatTime/formatDurationが未知(NaN・Infinity)を0:00へ潰さず、呼び出し側が未知を明示的に扱える
- [ ] #5 同一のdurationSecがトラック一覧とプレイヤーで同じ文字列に整形される（丸め方が統一されている）
- [ ] #6 pnpm checkとpnpm testが通り、既存の再生・シーク・曲送りに回帰がない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 背景（2026-07-25 TASK-92の敵対的レビューで顕在化）
TASK-91(カバー寸法) → TASK-92(トラック再生時間) と同型の「サーバーは知っているのにDTOに載せていない／未知を暗黙の値で埋める」病理の続き。
TASK-92 で DTO と UI 呼び出し側は null→明示的な未知に統一したが、その下層（probe結果の表現・フォーマッタ）に同じ病理が残っている。

## 具体的な現状（着手時に再確認すること）
- server/src/adapters/real/probe.ts: ファイル欠損・parseFile例外・duration欠落を**すべて null に潰している**
- server/src/adapters/real/scanner.ts: 不正start判定を `fileDurationSec - (track.start ?? 0) <= 0` としてインライン再実装（shared/src/work.ts の resolveTrackDurationSec と重複）
- client/src/shared/lib/format.ts: `formatTime` が `if (!sec || !isFinite(sec)) return "0:00"`。`formatDuration` も `if (!totalSec) return "0:00"`
- client/src/features/library/ui/preview/WorkTrackList.tsx: `formatDuration(Math.round(tr.durationSec))`（プレイヤー側の formatTime は切り捨て）。この Math.round は TASK-92 以前から存在する既存差分

## 設計の方向性（案。着手時に確定すること）
共通の判別可能な結果型（例: `{ kind: "resolved", durationSec } | { kind: "unprobed" } | { kind: "unsupported" } | { kind: "missing" } | { kind: "invalid-start" }`）を shared に置き、
probe・scanner・DTO・client が同じ型で計測結果を受け渡す。これにより AC1 と AC2 が同時に片づき、
「end指定時だけ不正startを取りこぼす」類の欠陥が構造的に再発しなくなる。

## 一緒に判断する検討事項
- **読み取り経路の副作用（CQS）**: TASK-92 で getWork が stat＋再probe＋DB書き込みを行うようになった。
  結果型を導入するなら読み取り経路の形も変わるため、ここで併せて判断する。
  「読み取りはキャッシュを返し、stale検知時はバックグラウンド更新」に寄せる案がある。
- **playerControllerの `stopRequested` で durationSec = 0**: 型が `number | null` になった今、0 は「トラック未ロード」を表すマジックナンバー。
  未知(null)との意味の違いが暗黙になっている。些細だが結果型導入のついでに整理できる。

## 関連
TASK-91（カバー寸法のデータ化）、TASK-92（トラック再生時間のDTO化）

- **client の Files/登録トラック判別が構造チェック**: client/src/features/player/model/trackTime.ts の `isResolvedTrack` が `"durationSec" in track` でFilesモードの即席Trackと登録トラック(ResolvedTrack)を判別している。zod検証済みDTOなので実行時は安全だが、登録トラック側でdurationSecが欠落すると黙って旧durationchange経路へ退行する形。Filesモード側に明示タグ(source: "files" 等)を持たせる案があり、結果型を入れるならあわせて判断する。2回目のCodexレビューでは指摘されなかった（実害は現時点で確認されていない）。

2026-07-30 全体レビューからの補足（Codexレビュー指摘#14、方向性はこのタスクと同じ）: server/src/adapter.ts:160・adapters/real/index.ts:848・routes/works.ts:71 で boolean/null が「不存在」と「処理障害」を兼用し、カバー計測失敗やFS読取失敗が404へ変換されうる。判別可能な結果型（not_found / invalid_media / io_error 等のResult union）を境界に入れる際の対象箇所として参照。
<!-- SECTION:NOTES:END -->
