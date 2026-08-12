---
id: TASK-311
title: source-first書き込みとCAS編集を実装しcatalog-first経路を廃止する
status: To Do
assignee: []
created_date: '2026-08-12 11:28'
labels: []
dependencies:
  - TASK-310
priority: high
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-55昇格（実装部分）。レビュー優先改善2。現状はworkMethods.tsがdb.transaction callback内でcatalog更新→sidecar書き込みの順に行い、sidecar書き込み成功後COMMIT前のクラッシュで不整合になる窓がある。TASK-310のADRに従い、アプリ編集をsource-first（sidecar確定→その作品だけcatalogへ再投影）へ統一する。編集画面取得時にsourceRevisionを返し、更新時に必須化、不一致は409 source_changed。未知フィールドを保持したままJSONへpatchし、一時ファイル書き込み＋fsync後のatomic replaceで確定する。catalog更新失敗時はsidecarが正として残り、次回scan/watcherで収束できること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 作品編集APIがsourceRevisionを返し、更新時に必須で、sidecar不一致時に409 source_changedを返す
- [ ] #2 アプリ編集がsidecar確定→catalog再投影の順で行われ、catalog-first更新経路が削除されている
- [ ] #3 sidecarの未知フィールドが編集後も保持される
- [ ] #4 catalog再投影の失敗がsidecarを壊さず、再scanで収束する
- [ ] #5 競合（外部編集との衝突）・再投影失敗・未知フィールド保持のテストがある
<!-- AC:END -->
