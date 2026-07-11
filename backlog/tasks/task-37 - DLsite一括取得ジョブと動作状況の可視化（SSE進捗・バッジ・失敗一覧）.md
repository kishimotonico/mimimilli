---
id: TASK-37
title: DLsite一括取得ジョブと動作状況の可視化（SSE進捗・バッジ・失敗一覧）
status: To Do
assignee: []
created_date: '2026-07-10 10:30'
updated_date: '2026-07-11 16:55'
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
- [ ] #2 既存作品への一括取得でタイトルが変更されない
- [ ] #3 ユーザーが削除したDLsite由来タグが一括取得で復活しない（appliedTags差分）
- [ ] #4 skipped/not_found/appliedの作品がスキップされる
- [ ] #5 進捗が配信され、完了トーストに成功・失敗件数が出る
- [ ] #6 レート制限（1秒以上間隔）が入っている
- [ ] #7 pnpm check / pnpm test が通る
<!-- AC:END -->
