---
id: TASK-36
title: DLsite手動取得UI（WorkDetailからfetch→プレビュー→選択適用）
status: Done
assignee: []
created_date: '2026-07-10 10:29'
updated_date: '2026-07-11 20:19'
labels: []
dependencies:
  - TASK-34
  - TASK-35
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkDetail に DLsite 手動取得の導線を配線する。fetch→diffプレビュー→選択適用のフロー。

## 決定済み仕様
- WorkDetailに連携状態バッジ（none=グレー未連携 / applied=緑 / error・not_found=赤＋hoverで理由 / skipped=グレー打消し）と「DLsiteから取得」ボタン
- rjCode未検出の作品はコード入力から開始。検出済みでも修正可能（dlsite.rjCodeへ保存）
- fetch結果は現在値と並べたdiffプレビューダイアログ:
  - タイトル / カバーは各チェックボックス
  - タグはタグ単位のチェックボックス（既に付いているタグはチェック不可の「適用済み」表示）
  - 契約 DlsiteApplyBody を選択制へ変更する（例: {info, applyTitle: boolean, applyCover: boolean, applyTags: string[]}。applyTagsは選択したタグの正規形リスト）
- apply成功で status=applied、appliedTags=今回適用を含むDLsite由来タグ集合、lastAttemptAt を記録しメタへ書き戻す
- 「この作品は連携しない」トグルで status=skipped / 解除で none
- 失敗時はTASK-35の分類別メッセージ（not_found時は「RJコードが違うかも」→コード修正への導線）

## 実装ガイド
- ダイアログ・トーストは docs/design-system.md の規約（z-index 40/41層、ConfirmDialog等の既存実装参照）
- mutation成功時のクエリinvalidateは workPatchInvalidation のパターンに従う（works/facets/tags/workDetail）
- 適用タグはshared normalizeTagsで正規化（既存のmergeDlsiteTagsは選択制に合わせて見直してよい）
- クライアントunitテスト（プレビューの選択→applyBody組み立てのロジック部分）と、契約変更ぶんのserverテスト更新
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 RJコード検出済み作品でfetch→プレビュー→選択適用がエンドツーエンドで動く
- [x] #2 タグをタグ単位で取捨選択でき、タイトル・カバーも個別に選べる
- [x] #3 RJコードの手動入力・修正とskippedトグルが動き、メタに永続化される
- [x] #4 not_found/parse_error/errorが区別されたメッセージで表示される
- [x] #5 apply後にstatus=appliedとappliedTagsが記録される
- [x] #6 pnpm check / pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 選択適用・RJコード更新・skipped切替のshared/adapter/API契約を定義する
2. real/fixtureで状態とメタ書き戻しをトランザクション境界に含め、適用ロジックを更新する
3. WorkDetailへ状態バッジ、コード編集、取得・diffプレビュー・選択適用UIを追加する
4. 選択ロジックとserver契約のテストを追加し、全体検証後に実機系ACを除いて完了・コミットする
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
DlsiteApplyBodyをタグ配列の選択適用へ変更。PATCH /dlsite/:idでRJコードとskippedを更新し、apply時は状態・appliedTags・メタ書き戻しを同一DBトランザクション境界に含めた。UIはAPI error.code別メッセージと選択プレビューを実装。検証: pnpm check / pnpm test（server 127件、client 142件）成功。AC#1の実ブラウザE2Eは依頼どおり未実施。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WorkDetailへDLsite状態バッジ、RJコード編集、skipped切替、取得から選択プレビュー・適用までのUIを追加した。タグ単位、タイトル、カバーを個別選択でき、適用状態をメタへ永続化する。自動テストは成功。実ブラウザでのfetch→適用確認はAC#1を未チェックで残した。
<!-- SECTION:FINAL_SUMMARY:END -->
