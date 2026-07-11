---
id: TASK-37
title: DLsite一括取得ジョブと動作状況の可視化（SSE進捗・バッジ・失敗一覧）
status: Done
assignee: []
created_date: '2026-07-10 10:30'
updated_date: '2026-07-11 20:25'
labels: []
dependencies:
  - TASK-36
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
「フォルダーに置いたら自動でDLsite情報が入る」を実現する自動取得ジョブ。

## 決定済み仕様（簡素化方針）
2つの入口で同じジョブ実装を使う:

1. スキャン後の自動取得（新規作品のみ）: スキャンで新規生成された作品のうちrjCode検出済みのものを対象に自動実行。**タイトル・タグ・カバーを適用する**（新規作品のタイトルはフォルダー名の仮置きなので上書きして安全）
2. 設定モーダルの「未連携をまとめて取得」ボタン: status が none / error の既存作品が対象。**タイトルは適用しない**（ユーザー編集の上書き事故防止）。タグはappliedTags差分（新infoにあって前回にないタグだけ追加）、カバーは未設定時のみ

共通ルール:
- skipped / not_found / applied はスキップ（appliedの再取得は手動UIから）
- リクエスト間隔1〜2秒のレート制限。リトライなし（失敗はstatus=error記録、再度ボタンで再試行）
- 結果を各作品の dlsite 状態（status/error/lastAttemptAt/appliedTags）に記録しメタへ書き戻す
- 進捗は既存のスキャン進捗SSE基盤（scanProgress.ts のジョブ+listener+replay構造）を流用または最小限の一般化で配信。完了時は「取得 N件・失敗 M件」のトースト
- 自動/確認の設定トグル・失敗一覧の専用ビューは作らない（バッジで足りる。必要になったら後続）

## 実装ガイド
- 外部通信をスキャン本体に混ぜない（スキャン完了後に別ジョブとしてキューイング）
- fixtureアダプタではネットワークに出ずスタブ結果でジョブフローだけ動くようにする（開発・テスト用）
- 一括ボタンはTASK-36のバッジ・状態表示を前提に設定モーダルへ配置
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャンで新規作品を置く→自動でタイトル・タグ・カバーが入る（実RJコードでのsmoke確認）
- [x] #2 既存作品への一括取得でタイトルが変更されない
- [x] #3 ユーザーが削除したDLsite由来タグが一括取得で復活しない（appliedTags差分）
- [x] #4 skipped/not_found/appliedの作品がスキップされる
- [x] #5 進捗が配信され、完了トーストに成功・失敗件数が出る
- [x] #6 レート制限（1秒以上間隔）が入っている
- [x] #7 pnpm check / pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DLsite一括ジョブの進捗契約とadapter境界を定義し、独立ジョブ基盤を追加する
2. realで新規/既存の適用方針、appliedTags差分、対象スキップ、1秒レート制限を実装する
3. スキャン完了後の新規作品ジョブ起動とfixtureスタブフローを配線する
4. 設定モーダルへ一括取得ボタン、SSE進捗購読、完了トーストを追加する
5. 自動テストと全体検証を行い、実機系ACを残して完了・コミットする
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
runDlsiteBulkをnew/existing共通ジョブとして実装し、スキャン完了後はnewWorkIdsを別ジョブへ渡す。既存一括はタイトルを保持し、appliedTagsに含まれる削除済みタグを再追加しない。既定の取得間隔は1000ms。SSEはprogress/complete/errorとterminal replayを配信し、設定モーダルで進捗と件数トーストを表示する。検証: pnpm check / pnpm test（server 131件、client 142件）成功。AC#1の実RJコードsmokeは依頼どおり未実施。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン後の新規作品自動取得と、設定モーダルからの既存作品一括取得を共通の独立ジョブで実装した。状態除外、差分タグ適用、1秒レート制限、SSE進捗、完了件数トーストを追加した。自動テストは成功。実RJコードでの新規作品smokeはAC#1を未チェックで残した。
<!-- SECTION:FINAL_SUMMARY:END -->
