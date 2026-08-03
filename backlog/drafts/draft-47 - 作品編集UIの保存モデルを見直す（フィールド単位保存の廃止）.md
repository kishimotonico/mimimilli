---
id: DRAFT-47
title: 作品編集UIの保存モデルを見直す（フィールド単位保存の廃止）
status: Draft
assignee: []
created_date: '2026-08-03 02:55'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-08-03のマージレビュー時にユーザーから出た要望。

現状の作品編集まわりは、フィールドやセクションごとに保存ボタンが分かれている（例: DlsiteEditorの「コードを保存」、WorkEditDialog・タイトル編集など経路ごとの保存）。これを全体的に見直したい。

方向性の候補（未決）:
1. 編集画面全体で「まとめて保存」1ボタンに集約する
2. 保存ボタンを無くしリアルタイム反映（自動保存）にする

着手前に決めること:
- どちらのモデルにするか（または画面・フィールド種別ごとの使い分け）
- リアルタイム反映の場合: デバウンス、失敗時のリトライとエラー表示、楽観更新の巻き戻し、RJ/VJコードのような副作用が重いフィールド（DLsite連携リセット・再取得）の扱い
- まとめて保存の場合: 未保存変更の管理、閉じ操作との関係（TASK-119のprogressive dismissal「編集中は編集のみキャンセル」との整合）、バリデーションのタイミング
- 対象範囲の棚卸し: WorkDetail内のインライン編集・WorkEditDialog・DlsiteEditor・ScanModalのタイトル編集・SettingsModalのフォルダーパス等、どこまで統一するか

着手を決めたらまず「保存モデルの要件を決める」タスクを切る。
<!-- SECTION:DESCRIPTION:END -->
