---
id: TASK-77
title: Filesモードの作品対応付けをインデックス化（O(E×N)探索の解消）
status: To Do
assignee: []
created_date: '2026-07-19 04:27'
labels: []
dependencies: []
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）で未タスク化と指摘された項目。browseFs()（server/src/adapters/real/fsBrowse.ts:26/57/68）が全summaryを取得し、ディレクトリエントリごとに works.find()、ファイルごとに全作品からowner探索するO(E×N)。ルート直下に大量エントリがあると顕著。physicalPath→workIdのMapと祖先探索用のパスインデックスを構築して解消する。TASK-57（listSummaries改善）だけではsummary取得コストは下がるが探索量は残る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 browseFs のエントリ・ファイルごとの探索が全件線形探索でなくなる（Map/パスインデックス）
- [ ] #2 既存のFilesモードの表示・作品対応付けが退行しない
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->
