---
id: TASK-164
title: ファイルモードからフォルダを作品として登録できるようにする
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-01 18:02'
updated_date: '2026-08-01 19:31'
labels: []
dependencies:
  - TASK-163
priority: high
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: ファイルモード要件整理 2026-08-02（本会話でユーザー合意）。作品の手動作成API/UIが存在せず登録はスキャン頼み（works.tsにcreate系なし）で、入れ子誤登録などを手動で直す手段がない。

要件（ユーザー合意済み）:
- 作品作成API: 指定フォルダに.meta.jsonを生成しDBへ登録する（scannerのgenerateMetaForFolderを流用可）。メタ正典はshared/src/meta.tsのmetaFileSchema
- ファイルモードのフォルダに「このフォルダを作品として登録」アクション＋確認ダイアログを追加する: タイトルはフォルダ名から事前入力され修正可能。フォルダ名等からRJコードを検出できた場合はDLsiteメタ取得をダイアログ内から実行可能。「そのまま登録」の即決ボタンも併設する
- 配下に登録済み子作品がある場合: ダイアログに「登録済み作品N件を解除して統合します」と明示し、承認で子の登録をまとめて解除してから親を登録する（履歴・タグの引継ぎはしない）
- 物理ファイルの移動・リネームはしない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 未登録フォルダに対して「このフォルダを作品として登録」アクションから確認ダイアログを開き、タイトルを編集した上で登録できる
- [ ] #2 「そのまま登録」の即決ボタンから確認ダイアログを経由せず素早く登録できる
- [ ] #3 フォルダ名等からRJコードが検出できる場合、ダイアログ内からDLsiteメタ取得を実行できる
- [ ] #4 配下に登録済み子作品があるフォルダを登録しようとすると、解除される子作品数が明示され、承認後に子の登録がまとめて解除されてから親が登録される
- [ ] #5 登録操作の前後で物理ファイル（音声・画像等）が一切移動・リネームされない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 作品作成API: 指定フォルダにmimimilli.jsonを生成しDB登録（generateMetaForFolder流用、ルート外拒否）
2. ファイルモードに「このフォルダを作品として登録」アクション＋確認ダイアログ（タイトル事前入力・編集可、RJコード検出時はDLsite取得可、即決ボタン併設）
3. 配下の登録済み子作品はN件明示→承認で一括解除→親登録（履歴・タグ引継ぎなし）
4. 物理ファイルの移動・リネームなし（テストで担保）
5. 実装はCursor(composer-2.5)へ委譲、Sonnet検証担当が自動テスト+agent-browser実機確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装エージェント引き継ぎ用の調査済み事実（別セッション調査、2026-08-02）:
- 作品の手動作成APIは存在しない（server/src/routes/works.tsにcreate系なし）。登録経路はスキャンのみ
- メタ自動生成の流用元: server/src/adapters/real/scanner.tsのgenerateMetaForFolder（:929-946）
- メタ正典: shared/src/meta.tsのmetaFileSchema（UUID id＋タイトル＋playlists、フォルダパス紐付けはDBのphysicalPathカラムでメタには持たない）
- DLsite取得の既存経路: client/src/features/library/ui/preview/DlsiteEditor.tsx（単一作品の再取得）が参考になる
- 環境メモ: 開発サーバーはdev:realで起動している場合がある（実DB。fixtureと挙動が違う点に注意）
<!-- SECTION:NOTES:END -->
