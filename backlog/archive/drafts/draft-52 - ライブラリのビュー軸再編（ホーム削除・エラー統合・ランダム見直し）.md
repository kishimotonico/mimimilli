---
id: DRAFT-52
title: ライブラリのビュー軸再編（ホーム削除・エラー統合・ランダム見直し）
status: Draft
assignee: []
created_date: '2026-08-10 19:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ドッグフーディングのフィードバック（2026-08-11）。ビュー軸は client/src/entities/library/axisDefinitions.ts:12-21 の固定定義（all/recent/added/fav/unplayed/missing）。方針: (1) ホームは実質使わないので削除する（必要になれば復活可能）。ホーム用のDiscoveryDashboard（client/src/features/library/ui/preview/DiscoveryDashboard.tsx）の扱いも決める。(2) 未再生（unplayed）ビューは削除する。(3) ファイル欠損（missing）は欠損以外のエラーも含む包括的な「エラー」ビューに広げ、該当0件のときは自動で非表示にする。(4) ソートのランダムは調査の結果、シード付きで正しくランダム実装済み（server/src/core/worksQuery.ts、japaneseSortKey.ts の stableRandomSortKey。ページング中は同一シードで安定、再取得で並び直し）。検索・タグで絞ってからランダム表示したいユースケースが主なので、ランダムビューの追加ではなくソート側を維持しつつ、明示的な再シャッフル導線（DiscoveryDashboard.tsx:107 の再生成ボタンのようなUX）を検討する。要件を詰めてからタスク分割する。
<!-- SECTION:DESCRIPTION:END -->
