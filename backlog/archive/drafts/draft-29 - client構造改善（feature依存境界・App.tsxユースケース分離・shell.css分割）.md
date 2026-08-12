---
id: DRAFT-29
title: client構造改善（feature依存境界・App.tsxユースケース分離・shell.css分割）
status: Draft
assignee: []
created_date: '2026-07-19 03:10'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘18,19,23のまとめ。裏取り済みの事実だが緊急性は低く、段階的に対応する。

- 指摘18: feature間依存が実質循環（player→libraryのqueryKey、navigation⇔library/filesのatom相互参照）。Query keyをwork entity側へ移し、依存制約をlintルールで機械検査する
- 指摘19: App.tsx（467行）が再生・スキャン・セットアップ・DLsite・通知・URL履歴・Query invalidationの集中点。app層のユースケースhookへ分離し、Appはレイアウトとイベント接続だけに。生のQuery key（["works"]等）はfactory経由に統一
- 指摘23: shell.css（2,638行）が全featureの共有名前空間。feature単位のlayerファイルへ分割し、tokenと共通primitiveだけをsharedへ

最初の一歩はTASK-64等で使った生Query keyのfactory統一と、oxlintの依存境界ルール導入あたりが安い。
<!-- SECTION:DESCRIPTION:END -->
