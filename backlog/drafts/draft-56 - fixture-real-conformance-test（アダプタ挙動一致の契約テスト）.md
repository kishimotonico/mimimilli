---
id: DRAFT-56
title: fixture/real conformance test（アダプタ挙動一致の契約テスト）
status: Draft
assignee: []
created_date: '2026-08-12 10:35'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-28（archive済み）関連指摘12の残件。

DataAdapterの6ポート分割（WorkAdapter/SettingsAdapter/ClassificationAdapter/FsAdapter/MediaAdapter/DlsiteAdapter）は完了済み。検索系は server/tests/real/worksQueryContract.test.ts でSQL↔core純粋関数の同値性を担保済みだが、検索以外（作品編集・スキャン・メディア等）のreal/fixtureの挙動一致を検証するテストは存在しない。fixture側は区間トラック（start/end）の合成に対応済み。

対象ポートと検証粒度（全ポートか、UI開発で差異が問題になりやすいポートだけか）を決めてから起票する。テストは網羅性より実行速度の方針に従い、低価値な網羅は避ける。
<!-- SECTION:DESCRIPTION:END -->
