---
id: TASK-210
title: ScanModalのサーバー状態ローカルコピーを解消する
status: To Do
assignee: []
created_date: '2026-08-06 04:58'
labels: []
dependencies: []
priority: medium
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/scan/ui/ScanModal.tsx が newWorks を useState<Work[]>（L56、取得は L109-128 の手書き Promise.all）で保持しており、TanStack Query キャッシュとは別のサーバー状態の局所コピーになっている。

TASK-124（App から購読をリーフへ降ろす）のときに useQueries ではなく手書き取得で済ませた判断が起点で、当時は表示するだけだったので問題なかった。その後に追加されたタイトル編集（handleSaveTitle、L141-158）が、このローカル配列だけを更新して WORK_QUERY_KEYS 側のキャッシュには invalidate も setQueryData もしないため、二重管理が実害を持つ状態になった。

症状: 新規スキャン結果一覧で作品タイトルを直しても、同じ作品をライブラリ側の詳細パネルで開いていた場合そちらは古いタイトルのまま残る。再フェッチが走るまでユーザーは食い違いに気づけない。

client 全体を洗った範囲で、サーバー状態の正本が2つに割れて実害が出ているのはこの1箇所のみ（RegisterWorkDialog の dlsiteInfo/title/tags や SmartFolderEditorModal の draft は編集用のフォーム下書きであり、二重管理ではない）。

## 方針

newWorkIds を useQueries（各 ID に対する getWork）へ置き換え、ローカル配列を持たない構造にする。handleSaveTitle は useMutation の onSuccess で queryClient.setQueryData するだけにすれば、ライブラリ側の詳細パネルへも同じキャッシュ経由で反映される。ローカルコピーを持たなければ食い違いは構造的に起きなくなる。

mutation 部分は TASK-206（サーバー更新の状態管理を useMutation へ統一）と対象が重なるため、あわせて着手すると効率的。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanModal が新規作品の一覧を TanStack Query 経由で取得しており、useState によるサーバー状態のローカルコピーを持っていない
- [ ] #2 スキャン結果一覧でタイトルを編集すると、ライブラリ側の作品詳細にも再フェッチを待たずに反映される
- [ ] #3 手書きの Promise.all による取得が残っていない
- [ ] #4 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
