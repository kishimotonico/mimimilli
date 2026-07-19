---
id: TASK-61
title: ライブラリ検索のデバウンスとリクエスト中断（AbortSignal）
status: To Do
assignee: []
created_date: '2026-07-19 02:02'
updated_date: '2026-07-19 04:28'
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
- [ ] #1 検索クエリの発行がデバウンス（またはuseDeferredValue）で間引かれる
- [ ] #2 古い検索リクエストがAbortSignalで中断される（React QueryのsignalがfetchへPassされる）
- [ ] #3 pnpm check と pnpm test が通る
- [ ] #4 短時間にN文字入力しても待機後の最新値で1回だけリクエストされる（実際の通信回数で検証。fake timer等で決定的にテスト）
- [ ] #5 abortはエラーとして表示・ログ・retryされない。古いレスポンスが新しい結果を上書きしない
- [ ] #6 入力欄の表示は遅延しない。検索クリアは待機なしで反映。日本語IMEのcomposition中に中間文字列でリクエストが乱発しない
<!-- AC:END -->
