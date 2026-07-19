---
id: TASK-61
title: ライブラリ検索のデバウンスとリクエスト中断（AbortSignal）
status: In Progress
assignee:
  - '@kimi'
created_date: '2026-07-19 02:02'
updated_date: '2026-07-19 12:47'
labels: []
dependencies: []
priority: high
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
検索入力（client/src/features/library/ui/TopBar.tsx:84）が1文字ごとにstateへ入り、React Queryのqueryが毎回発行される。fetch（client/src/shared/api/http.ts:61）にAbortSignalが渡っておらず、古い検索もサーバーで最後まで処理される。数万件規模では1文字ごとに全件フィルタ+ソート+全件転送+Zod検証が重なる。

方針: 200〜300msのデバウンスまたはuseDeferredValue、queryFnのAbortSignalをfetchへ伝播。2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 検索クエリの発行がデバウンス（またはuseDeferredValue）で間引かれる
- [x] #2 古い検索リクエストがAbortSignalで中断される（React QueryのsignalがfetchへPassされる）
- [x] #3 pnpm check と pnpm test が通る
- [x] #4 短時間にN文字入力しても待機後の最新値で1回だけリクエストされる（実際の通信回数で検証。fake timer等で決定的にテスト）
- [x] #5 abortはエラーとして表示・ログ・retryされない。古いレスポンスが新しい結果を上書きしない
- [x] #6 入力欄の表示は遅延しない。検索クリアは待機なしで反映。日本語IMEのcomposition中に中間文字列でリクエストが乱発しない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shared/lib/useDebouncedValue.ts 新規（汎用デバウンス、immediate時は即時反映） 2. http.ts の getParsed に signal オプション追加 3. searchWorks が signal を受けfetchへ伝播 4. useLibraryQueries で検索語を250msデバウンス（空文字クリアは即時）し queryFn に React Query の signal を渡す 5. TopBar で IME composition 中は親通知を保留し draft state で表示即時更新（compositionend で確定通知） 6. テスト: useDebouncedValue 単体(fake timer) / useLibraryQueries の検索リクエスト回数(fetch mock で /api/works 呼出回数) / TopBar IME / signal 伝播 7. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
検索語をuseDebouncedValue(250ms, 空クリア即時)で間引き、React Queryのsignalをfetchへ伝播して古い検索を中断。TopBarはIME composition中の親通知を保留しdraftで表示即時更新。テスト12件追加(デバウンス回数・abort・IME・クリア即時)。pnpm check・pnpm test(server183/client273)すべてパス
<!-- SECTION:FINAL_SUMMARY:END -->
