---
id: TASK-431
title: 'tsxに残るtext-[Npx]直書きを意味別トークンへ移行する'
status: To Do
assignee: []
created_date: '2026-09-07 13:45'
labels:
  - ui
  - design-system
  - tokens
dependencies: []
priority: medium
ordinal: 452000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.20で意味別タイポグラフィトークン（text-body / text-secondary / text-caption / text-control / text-label / text-mono）を新設し、shell/*.cssと共有UIプリミティブ・主要フローのtsx約50箇所を移行した。各featureディレクトリに散在する残り約140箇所のarbitrary値（text-[Npx]）は、1箇所ずつ意味的な役割の判断が必要なため未移行のまま残っている。トークンと直書きの混在を解消する。

半端な値は6段トークンへ丸める（TASK-428.20と同じ方針。オーナー了承済み）。丸めによって見た目が変わる箇所は許容するが、+2px級の変化が起きる箇所は報告に列挙する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 featureディレクトリのtsxに残る text-[Npx] 直書きが意味別トークンへ移行されている
- [ ] #2 移行後にリポジトリ全体で text-[Npx] のarbitrary値が残っていないことをgrepで確認できる（13px以上の見出し級で意図的に据え置く箇所があれば、その一覧と理由をdocs/design-system.mdに明記する）
- [ ] #3 丸めによって2px以上サイズが変わる箇所を一覧化し、実機確認の結果を実装メモに記録する
- [ ] #4 pnpm test:smokeに新規失敗がない
<!-- AC:END -->
