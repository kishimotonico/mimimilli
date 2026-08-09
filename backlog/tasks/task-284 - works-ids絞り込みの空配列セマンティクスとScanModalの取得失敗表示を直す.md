---
id: TASK-284
title: works ids絞り込みの空配列セマンティクスとScanModalの取得失敗表示を直す
status: To Do
assignee: []
created_date: '2026-08-09 15:43'
labels: []
dependencies: []
ordinal: 294000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-210/276のマージ後、Codexによる最終レビューで検出した2件。

1. 空配列のセマンティクスがクライアントだけ反転している
client/src/entities/work/api.ts:56 の searchWorks は `for (const id of params.ids ?? []) p.append("ids", id)` で ids を組み立てるため、`ids: []` を渡すとクエリパラメータが1つも付かず /works になり、サーバーは未指定と解釈して全作品を返す。一方 server/src/core/worksQuery.ts の filterByIds と real の SQL は空配列を空集合(0件)として扱い、worksQueryContract.test.ts がその同値性を検証している。現状 ScanModal は enabled ガードで踏んでいないが、共有API関数に残る罠。全作品が返る方向の誤りなので実害が大きい。

2. 新規作品一覧の取得失敗が無表示
client/src/features/scan/ui/ScanModal.tsx:208 の表示条件が newWorks.length > 0 のみで、works一覧クエリがエラーになると一覧もエラーメッセージも表示されない。統計バッジには新規検出件数が出るため、ユーザーは作品が切り捨てられたと誤認する。旧実装は「新規作品の読み込みに失敗しました」を表示していた。設計変更で取得経路が復活した際の戻し忘れ。エラー表示の契約は docs/adr/ の ADR-0015 に従うこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 searchWorks に空配列の ids を渡したときサーバーへリクエストせず0件を返し、core・realと同じセマンティクスになっている
- [ ] #2 上記がテストで担保されている
- [ ] #3 ScanModalで新規作品一覧の取得が失敗したとき、エラーが表示される（ADR-0015のエラー処理契約に従うこと）
- [ ] #4 上記がテストで担保されている
- [ ] #5 pnpm check と pnpm test と pnpm test:smoke が通る
<!-- AC:END -->
