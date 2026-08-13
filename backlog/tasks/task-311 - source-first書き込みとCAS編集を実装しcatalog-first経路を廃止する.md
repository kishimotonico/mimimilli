---
id: TASK-311
title: source-first書き込みとCAS編集を実装しcatalog-first経路を廃止する
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 11:28'
updated_date: '2026-08-13 17:55'
labels: []
dependencies:
  - TASK-310
priority: high
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
draft-55昇格（実装部分）。レビュー優先改善2。現状はworkMethods.tsがdb.transaction callback内でcatalog更新→mimimilli.json書き込みの順に行い、mimimilli.json書き込み成功後COMMIT前のクラッシュで不整合になる窓がある。TASK-310のADRに従い、アプリ編集をsource-first（mimimilli.json確定→その作品だけcatalogへ再投影）へ統一する。編集画面取得時にsourceRevisionを返し、更新時に必須化、不一致は409 source_changed。未知フィールドを保持したままJSONへpatchし、一時ファイル書き込み＋fsync後のatomic replaceで確定する。catalog更新失敗時はmimimilli.jsonが正として残り、次回scan/watcherで収束できること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品編集APIがsourceRevisionを返し、更新時に必須で、sidecar不一致時に409 source_changedを返す
- [x] #2 アプリ編集がsidecar確定→catalog再投影の順で行われ、catalog-first更新経路が削除されている
- [x] #3 sidecarの未知フィールドが編集後も保持される
- [x] #4 catalog再投影の失敗がsidecarを壊さず、再scanで収束する
- [x] #5 競合（外部編集との衝突）・再投影失敗・未知フィールド保持のテストがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 編集API・共有契約と既存実装/テストを確認する。 2. sidecarのCAS atomic patchと単一作品catalog再投影を実装する。 3. API・client契約を更新し、競合・再投影失敗・未知フィールド保持をテストする。 4. 受け入れ条件と実装メモをBacklogへ記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
source-first CASと単一作品再投影を実装。DLsite既存書込みも同じhelperへ寄せ、TASK-320はpreview/明示承認UIとcache policyを担当する境界として残す。

検証: bun test tests/app.test.ts tests/real/metaWriteback.test.ts tests/real/dlsite.test.ts tests/workSchema.test.ts（93件成功）。git diff --check成功。

レビュー対応: Windows置換、source_changed後のclient再取得、残存CASなしsidecar書込みを確認・修正する。

レビュー対応完了: Windowsで既存fileのrenameが失敗する場合はrollback入替・失敗時復元を行う。source_changedを含むPATCH失敗時はLibrary/ScanModalの詳細queryをinvalidateする。rg 'patchMetaFile\(' server/src/adapters/real は0件で、restore・RJ検出・同一Work ID修復もCAS bytes比較を通す。検証93件成功、diff check成功。

最終レビュー対応: install失敗後にrestoreも失敗した場合はrollbackを保持し、復元失敗をcause付きで返すfile-ops注入テストを追加。SourceChangedErrorをserver/src/errors.tsへ移しrouteのreal adapter依存を除去。検証94件成功、diff check成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品とDLsiteの全sidecar書込みをsource-first CASへ統一した。Windows置換はrollback入替で復元失敗時にも旧正本を保持し、競合時はclient詳細queryを再取得する。SourceChangedErrorはadapter-neutralなserver errorsへ移した。formatVersion 1必須と単一作品catalog再投影を追加し、94件の関連テストで確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
