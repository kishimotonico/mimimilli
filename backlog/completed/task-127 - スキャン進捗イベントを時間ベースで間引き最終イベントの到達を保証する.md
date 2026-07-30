---
id: TASK-127
title: スキャン進捗イベントを時間ベースで間引き最終イベントの到達を保証する
status: Done
assignee: []
created_date: '2026-07-29 18:57'
updated_date: '2026-07-29 19:04'
labels: []
dependencies: []
priority: low
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン中の再レンダリングが多い。真因は TASK-124（App の Query 購読降ろし）とは別経路にあり、TASK-124 を適用しても解消しない。

## 現状（確認済み）

server/src/adapters/real/scanner.ts では walking フェーズのみ WALK_PROGRESS_INTERVAL = 50（:72,125）で間引いているが、registering（:466）と generating（:500）は1件ごとに間引きなしで emit している。scanJobManager.ts:157-170 も受けた progress をそのまま SSE へ流しており、サーバ側のデバウンスは一切ない。

クライアント側は useScanJob.ts:144-163 が SSE イベントごとに同期的に setJob を呼ぶ。EventSource の各メッセージは別タスクなので React のバッチングでまとまらず、1イベント＝1レンダーになる。さらに ScanRuntime.tsx:39-41 の useEffect 経由で Jotai の scanJobAtom へ書くため、1イベントにつき2段のレンダーが連鎖する。数千作品のライブラリなら数千回。

影響範囲は限定的で、TopBar は AppShell のスロット構造上 LibraryView / WorkGrid の兄弟であり祖先ではないため、巻き添えは TopBar サブツリーと（開いていれば）ScanModal に閉じる（静的読解ベース、実測は未）。優先度が低いのはこのため。

## 方針

発生源を絶つのが本筋なので、サーバ側で間引く。

walking の「50件ごと」方式の流用は避け、時間ベース（最短200〜250ms間隔）にする。registering / generating は1件あたりの処理時間の分散が大きく、件数ベースだと遅い区間で進捗表示が長時間固まって見えるため。

加えて「フェーズの最終イベント（processed === total）は間引きの対象外として無条件に emit する」ことを必須にする。これがないと間引きの端数でフェーズ末尾の進捗表示が欠ける。

クライアント側の useScanJob → ScanRuntime の2段連鎖は、サーバ側の間引きで頻度が落ちるため本タスクでは手を入れない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 registering / generating フェーズの progress イベントが時間ベース（最短200〜250ms間隔）で間引かれている
- [x] #2 各フェーズの最終イベント（processed === total）は間引きの対象外で、必ず emit される
- [x] #3 間引きの前後でスキャン完了時の統計・結果表示（scanJobManager の snapshot 由来）が変わらない
- [x] #4 大量ファイルを含むスキャンで、進捗表示が遅い区間でも一定間隔で更新され続ける（件数ベース間引きのような長時間の固まりが起きない）
- [x] #5 間引きロジックにテストがあり、最終イベントが必ず通ることを検証している
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/src/adapters/real/progressThrottle.ts を新規追加。時間ベース間引きロジック createProgressThrottle(minIntervalMs, now?) を切り出す。processed===totalは常にtrue、それ以外はnow()-lastEmitAt>=minIntervalMsで判定。clockを注入可能にしテストではsleep不要にする。
2. scanner.ts の registering フェーズ(466-471)・generating フェーズ(500)のemitをこの関数でラップして間引く。walking(50件区切り)は対象外のまま維持(totalが常に0で不定進捗のため最終イベントの概念がなく、既存設計を流用できないため)。
3. server/tests/real/progressThrottle.test.ts を追加。間引き判定・最終イベント強制emit・時間経過での再emitを注入clockで検証する。
4. pnpm check / pnpm test を実行し確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。

変更ファイル:
- server/src/adapters/real/progressThrottle.ts (新規): createProgressThrottle(minIntervalMs, now?) を切り出し。processed===totalは無条件true、それ以外はnow()-lastEmitAt>=minIntervalMsで判定。clock注入可能。
- server/src/adapters/real/scanner.ts: registering(466付近)・generatingフェーズのemitを上記throttle(200ms)でラップ。PROGRESS_MIN_INTERVAL_MS=200を追加。
- server/tests/real/progressThrottle.test.ts (新規): 間引き・再emit・最終イベント強制emitを注入clockで検証（sleep非依存）。

設計判断:
- walkingフェーズ(WALK_PROGRESS_INTERVAL=50)は今回スコープ外のまま維持。totalが常に0(不定進捗)でprocessed===totalによる最終イベント判定が意味を持たず、既存のcreateProgressThrottleをそのまま流用できないため。件数ベースのままでも許容範囲と判断（タスク記述の判断に従い大きく広げていない）。
- scanJobManager.tsは変更なし。間引きはscanner.ts側のemit呼び出し時点で完結しており、scanJobManagerはemitされたイベントをそのまま流すだけなので改修不要（AC#3の統計・結果表示はresultオブジェクト経由で間引きの影響を受けない）。

pnpm check: 全パス（tsc/oxlint/oxfmt）
pnpm test: server 344 pass, client 343 pass

コミットはしていません（作業ツリーに差分を残しています）。

検証担当による確認完了。AC5件すべて合格。AC#5は progressThrottle.ts の processed===total 分岐を一時削除して破壊テストを実施し、「最終イベントは間引き条件を無視して必ずemitされる」が AssertionError: false !== true で失敗することを確認（確認後に完全復元）。AC#3は scanJobManager.ts:145-179 の finishCompleted が adapter.scan() の戻り値 ScanResult を直接使い、progress イベント経路（:165-170）とは独立であることを裏取り。throttle インスタンスは scan() 内のローカル変数でフェーズ間・実行間の共有なし。pnpm check 全パス、pnpm test は server 344 pass / client 343 pass。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scanner.ts の registering / generating フェーズが1件ごとに間引きなしで progress を emit していたため、スキャン中の再レンダリングが数千回規模になっていた。createProgressThrottle（時間ベース・最短200ms、processed===total は無条件emit、now 注入でテスト可能）を新設して両フェーズに適用。walking は total=0 の不定進捗で最終イベント判定が成立しないため対象外のまま維持。検証担当が破壊テストを含めて AC5件の合格を確認。
<!-- SECTION:FINAL_SUMMARY:END -->
