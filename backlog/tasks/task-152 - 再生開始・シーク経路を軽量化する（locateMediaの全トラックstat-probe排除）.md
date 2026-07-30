---
id: TASK-152
title: 再生開始・シーク経路を軽量化する（locateMediaの全トラックstat/probe排除）
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 17:52'
updated_date: '2026-07-30 18:12'
labels: []
dependencies: []
priority: high
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
locateMedia()（server/src/adapters/real/index.ts:791付近）がgetWork()を呼び、workRepo.ts:398付近で作品の全トラックをstatし、キャッシュ不一致時はprobe・DB更新まで行う。再生開始・シークのたびにこの経路を通るため、トラック数が多い作品で待ちが発生しうる。メディア位置解決に必要なのは対象トラックのphysical_path/statusのみなので、軽量な専用問い合わせへ分離する。2026-07-31調査第2波・Codexレビューで最優先候補とされた項目。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 再生開始・シーク時のメディア解決が、対象トラックのphysical_path/status等の必要最小情報のみを取得する専用経路になっている（作品全トラックのstat・probe・DB更新が発生しない）
- [ ] #2 既存の再生・シーク挙動（Range/206含む）が退行しない（既存テストと必要な追加テストが通る）
- [ ] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. メディア解決専用の軽量問い合わせ（対象トラックのphysical_path/status最小取得）を設計・追加
2. locateMediaをgetWork()非依存へ（全トラックstat/probe/DB更新の排除）
3. 退行テスト+解決経路のクエリ・stat回数を検証するテスト
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->
