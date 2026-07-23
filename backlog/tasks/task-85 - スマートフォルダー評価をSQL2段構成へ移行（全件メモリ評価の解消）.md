---
id: TASK-85
title: スマートフォルダー評価をSQL2段構成へ移行（全件メモリ評価の解消）
status: To Do
assignee: []
created_date: '2026-07-23 05:58'
labels: []
dependencies: []
priority: high
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
perf施策で /api/works はSQL(WHERE/ORDER/LIMIT)移行済みだが、evalSmartFolder(server/src/adapters/real/index.ts:462-472)だけ repo.listSummaries() で全作品をメモリロードし、urls_json・DLsite state・全タグJOINを毎回パースしてからJSでフィルタ・ソート・ページングする旧ADR-0004方式のまま。ADR-0008は『SQLで候補を絞ってから純粋関数で最終評価』を規定しており実装が追従していない。数万件規模でスマートフォルダー経路だけ遅くなる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SQLに落とせる条件(タグ等)はWorkRepo側で候補ID集合まで絞り込み、残りだけ純粋関数で最終評価・ページングする2段構成になっている
- [ ] #2 worksQueryContract相当のテストにスマートフォルダーの/works同値性ケースが追加され、既存の純粋関数評価と同じ結果になることを保証している
- [ ] #3 同規模フィクスチャでの性能が全件メモリ評価より改善している(または少なくとも/worksと同等スケール特性)
<!-- AC:END -->
