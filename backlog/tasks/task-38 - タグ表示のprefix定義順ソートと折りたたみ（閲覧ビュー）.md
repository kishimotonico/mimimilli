---
id: TASK-38
title: タグ表示のprefix定義順ソートと折りたたみ（閲覧ビュー）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-17 12:19'
updated_date: '2026-07-17 12:32'
labels: []
dependencies: []
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細（WorkDetail）のタグチップ列に表示順ソートと折りたたみを導入する。現状はwork.tagsの登録順そのままで、DLsite取得タグが末尾追加されるためCV・サークルがジャンルに埋もれる。また折りたたみが無く、タグ11個超でチップが5行以上積み上がり詳細ペイン・グリッドインスペクタが縦に膨張する。

方針:
- 保存順（work.tags配列）は変更せず、表示時のみtag_prefixes定義順（CV→サークル→シリーズ→カテゴリ→ジャンル→未登録prefix→prefixなし）でソートする
- 閲覧時は上位N個（2行に収まる程度）＋「+N」チップで残数を表示し、クリックでその場に全展開する

関連: client/src/features/library/ui/preview/WorkTagEditor.tsx, useWorkTagEditor.ts:146, entities/work/ui/Tag.tsx, shared/src/tagPrefix.ts（定義順の正典）, shell.css .mle-prv__tags
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 詳細ペイン・グリッドインスペクタのタグ表示がprefix定義順（CV・サークルが先頭）になる
- [x] #2 タグが閾値を超える作品では上位のみ＋「+N」チップ表示になり、クリックで全展開できる
- [x] #3 タグ追加・削除・undoなど既存の編集操作が折りたたみ状態でも壊れない
- [x] #4 work.tagsの保存順・PATCH内容は変化しない（表示のみのソート）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 表示専用ソートの純関数を追加（tag_prefixes定義順→未登録prefix→prefixなし、グループ内は元順維持）＋ユニットテスト
2. WorkTagEditorの表示を折りたたみ対応（上位N＋「+N」チップ、クリックで全展開、+ボタンは常時表示）
3. 実装はCodexに委譲、pnpm check/testはCodex側、ブラウザ実機検証はClaude側（agent-browser）
4. コミットはClaude側で実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex(019f700c)に実装委譲。sortTagsForDisplay.ts新設（定義順→未登録prefix→flat、stable・非破壊）＋unit test。WorkTagEditorはCOLLAPSED_TAG_LIMIT=8で折りたたみ、+NチップはTag再利用（aria-label付き）。pnpm check/test通過（server 19件・client 171件）。agent-browserでタグ11個の作品を実機確認: CV→サークル→ジャンル順・8個+「+3」表示・クリック全展開OK。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグ表示をprefix定義順（CV→サークル→…→未登録→flat）の表示専用ソートにし、8個超は「+N」チップで折りたたみ・クリック全展開を実装。保存順・PATCHは不変。unit test追加、check/test通過、実機検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
