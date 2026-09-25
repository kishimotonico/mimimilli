---
id: TASK-470.2
title: DlsiteBulkRuntimeの受信履歴管理をprogress表示専用化する
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 07:22'
updated_date: '2026-09-25 13:33'
labels:
  - dlsite
  - ui
dependencies: []
parent_task_id: TASK-470
priority: medium
ordinal: 527000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のコード根拠: client/src/features/dlsite/ui/DlsiteBulkRuntime.tsx（freshStartRef/missedProgressによる受信履歴管理）、client/src/features/dlsite/model/dlsiteInvalidation.ts（ID指定によらない無効化と、作品詳細のみのID選択性）。

新しいADRはS2.1側で記録する「進捗=現在状態」の原則を引用し、本タスク固有の追加決定があればここに記録する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DlsiteBulkRuntime.tsxのfreshStartRef/missedProgressなど受信履歴管理が削除され、progressは表示専用になる
- [x] #2 完了・取消後のキャッシュ更新が受信履歴の完全性に依存しない一定の方針で行われる
- [x] #3 作品詳細の選択的無効化が必要な場合、終端結果にサーバー確定の対象Work IDが含まれ、それを使って行われる
- [x] #4 進捗イベントの一部欠落時でも、完了・取消の最終結果が正しく反映されることをテストで確認する
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
方針はADR-0030の「DLsiteの契約」「完了を失わない規則」「DLsite一括取得の終端でのキャッシュ更新」。470.1 の後に同じ worktree で行う。shared の型変更は scan（470.1: scanJobEventSchema）と dlsite（470.2: 一括取得の snapshot・イベント・開始応答）で重ならないため、470.1→470.2 の順で各タスク内で server/client を一括追随し、各コミット時点で pnpm check が通る単位にする。

real/fixture: DLsite 一括取得のジョブ概念（キュー・現在ジョブ・直近終端）は adapter ではなく共通層の server/src/dlsiteJobManager.ts だけにあり、real（adapters/real/dlsiteBulk.ts）と fixture（adapters/fixture/dlsiteMethods.ts）は runDlsiteBulk で DlsiteBulkResult を返すだけ。契約変更は共通層で行えば両方に同じく効くので adapter は触らない。

server / shared:
1. shared/src/dlsite.ts: dlsiteBulkStartResponseSchema を { jobId }、dlsiteBulkProgressEventSchema の全種に jobId を追加、dlsiteBulkSnapshotSchema を { current: { jobId, status: running|cancelling, progress } | null, lastTerminal: { jobId, status: complete|cancelled, result } | { jobId, status: error, message } | null } に置き換える（204 は廃止）。DlsiteBulkResult は変えない。
2. server/src/dlsiteJobManager.ts: PendingJob に enqueue 時点で randomUUID の jobId を採番し enqueue が jobId を返す。ActiveJob に jobId、emit するイベントに jobId を付ける。lastTerminal は jobId 付きで保持。getSnapshot は { current, lastTerminal } を返す（current 実行中でも lastTerminal を消さない。startJob の lastTerminal = null クリアは削除）。subscribe は現行どおり同期1手（実行中なら直近 progress、でなければ直近終端）。
3. server/src/routes/dlsite.ts: POST /dlsite/bulk は 202 { jobId }、GET /dlsite/bulk は常に 200 で snapshot。SSE は jobId 付きイベントをそのまま送る。app.ts の enqueue 呼び出し（scan 完了・候補登録・単体登録）は戻り値を使わないのでシグネチャ追随のみ。

client:
4. entities/work/api.ts: startDlsiteBulk は jobId を返す。getDlsiteBulkStatus は noContentAsNull をやめ { current, lastTerminal } を返す。
5. entities/work/model/workCacheUpdates.ts: updateCachesAfterDlsiteBulkFetch(queryClient) にし processedWorkIds・progressMayBeMissed を削除。常に invalidateAllWorkDetails と invalidateLibraryViews。
6. features/dlsite/ui/DlsiteBulkRuntime.tsx: freshStartRef・missedProgress・updatedWorkIds と関連コメントを削除し、progress は setProgress の表示専用。active: boolean の代わりに追跡中ジョブ ID を持つ（atom の形は既存 bulkAtoms に合わせて最小に変える）。start は POST 応答の jobId、attach は GET の current.jobId（current が無く lastTerminal があれば従来どおりその結果を通知、キャッシュ更新も行う）を追跡する。確定規則（ADR）: 追跡中 X の終端イベント・接続エラー・再接続（ネイティブ error）・X 以外の jobId のイベントを受けたら GET /dlsite/bulk で確定する。lastTerminal.jobId===X → 結果を通知し終端処理（進捗クリア・追跡解除・一覧系＋全詳細の無効化）。current.jobId===X → 追跡継続（cancelling/progress を反映）。どちらでもない → 通知なしで同じキャッシュ更新を行い X の追跡を終え、current があればその jobId の追跡へ移る。X の progress/cancelling は表示に反映。古い照会は既存の createSseGeneration で破棄。EventSource が CLOSED で X が current のままのときの接続切断エラー表示は現行の扱いを維持。
7. 469.2 の挙動を守る: 確定 GET の 409 root_reconfiguring で detach（追跡解除＋resetTerminalState）しトーストを出さない、attach()（ReconfigurationExitEffect から呼ばれる後乗り）の経路。ロジックを変えず追随のみ。
8. docs: HANDOFF.md の /dlsite/bulk 行（204 記述）を新契約へ、design-system.md:166 の記述が新契約と矛盾しないか確認。ADR-0028 本文は書き換えない（ADR-0030 が該当行を置き換える）。

テスト（変更範囲のみ実行）:
- server: dlsiteProgress.test.ts（getSnapshot の形、イベントの jobId）、dlsiteEventsRoute.test.ts、app.test.ts の GET /api/dlsite/bulk・DELETE・__test__/reset の3件、scanCompletionDlsiteEnqueue.test.ts の 204 判定2件は契約変更に伴う書き換え（期待の意味は維持し、status 204→ current/lastTerminal の null 判定へ）。追加: 終端直後に次のジョブが始まっても current と lastTerminal が別 jobId で両方返る、POST 応答の jobId が以後のイベント・snapshot の jobId と一致する。
- client/tests/unit/workCacheUpdates.test.ts: 「一括取得の完了は処理対象の詳細だけを無効化する」「一括取得の処理対象が0件なら詳細を一切無効化しない」「進捗を取りこぼした可能性があれば全詳細を無効化する」の3件を「一括取得の終端は全詳細と一覧系を無効化する」1件に書き換え。
- client/tests/unit/runtimeEventSource.test.tsx: 選択的無効化前提の2件（「start()から購読を開始した場合、完了時は処理対象workIdの詳細キャッシュだけを無効化する…」「start()後にSSEが切断→再接続した場合…全作品を無効化する」）を書き換え、AC#4: progress の一部（または全部）が欠けたまま complete / cancelled が届いても、GET の lastTerminal 一致で結果トースト・追跡解除・進捗クリア・全詳細＋一覧系の無効化が行われる。追加: 切断中に次ジョブへ進んだ（GET が current=Y・lastTerminal=Y' で X なし）場合に通知なしで全無効化し Y へ乗り換える、追跡外 jobId のイベントで確定 GET が走る、確定 GET の 409 root_reconfiguring で追跡解除・進捗クリア・トーストなし（469.2）。既存のイベント dispatch と GET モックは jobId 付き・新 snapshot 形へ追随（期待値は変えない）。
- client/tests/unit/api.test.ts（startDlsiteBulk のスキーマ検証）、appReconfiguringScreen.test.tsx（getDlsiteBulkStatus のモック戻り値を { current: null, lastTerminal: null } へ）、reconfigurationExitEffect.test.tsx は追随のみ。
- 最後に 470.1 と合わせて pnpm check && pnpm test && pnpm test:smoke を1回。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装 9be32983。DLsiteジョブにjobIdを採番しPOST応答・SSE・GET {current,lastTerminal}へ載せた。終端・接続エラー・再接続・追跡外jobIdでGET確定。AC#3は選択的無効化を採らない判断（ADR-0030）で未チェックのまま統括判断待ち。

AC#3: ADR-0030で終端時は常に一覧系+全作品詳細を無効化する方針とし、終端結果にWork IDを載せての選択的無効化は不要と判断（activeなobserverだけが再取得するため開いている詳細の再取得で済む、DlsiteBulkResultの契約拡張をDRAFT-76と重ねない）。条件付きACのため判断をもって充足とする。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite一括取得ジョブにjobIdを持たせ（POST {jobId}、GET {current,lastTerminal}、SSE各イベントにjobId）、DlsiteBulkRuntimeは追跡jobIdと確定GETの3分岐で終端を確定する形にした。freshStartRef/missedProgress/updatedWorkIdsを削除しprogressは表示専用、終端では常に一覧系+全詳細を無効化（ADR-0030）。検証: runtimeEventSource等のテスト、pnpm check・test・smoke緑。master aa3b08c3。
<!-- SECTION:FINAL_SUMMARY:END -->
