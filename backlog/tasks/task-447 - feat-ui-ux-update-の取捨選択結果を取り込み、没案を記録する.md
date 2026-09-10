---
id: TASK-447
title: feat/ui-ux-update の取捨選択結果を取り込み、没案を記録する
status: To Do
assignee: []
created_date: '2026-09-10 18:05'
labels:
  - ui
  - ux
  - triage
dependencies: []
references:
  - 'https://claude.ai/code/artifact/cd92119f-6e09-417d-aa95-bcf28885fb12'
  - tmp/uiux-triage-2026-09-11/
priority: high
ordinal: 468000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
UI/UX監査で実装した36タスク（TASK-428.1〜428.24、429〜440、118コミット）を含む feat/ui-ux-update を、ユーザーの「残す／直して残す／戻す」判定に従って取り込む。masterはUI変更前（1c64eda）にリセット済みで、ブランチは未マージ。

判定はユーザーが判定シート（Artifact: https://claude.ai/code/artifact/cd92119f-6e09-417d-aa95-bcf28885fb12 、Claude Codeの /artifacts からも開ける）上で行い、結果はArtifactのDBに verdicts/<taskId> = {verdict: keep|fix|drop, reason, updatedAt} として保存される。次のエージェントは Artifact ツールの read_db（collection: verdicts, db_op: list）で全件を読み取ってから着手する。

品質ゲート（2026-09-11）: 設計レビューでブランチ丸ごと破棄は不要と判定。既存設計（TASK-368/415、ADR-0012/0016）の破壊なし、「筋が悪い」タスク0件、「直せば残せる」7件（428.14, 428.17, 428.18, 428.21, 428.22, 430, 432）。fixture largeでの性能実測は操作中の差1〜3%で同等、初回ロード直後のlongtaskのみ1.8倍。未確認: 428.22/432が作る「軸数×スマートフォルダー数」の全件集計クエリ束は実データ（SQLite）で未計測。

調査レポート一式（gitignore対象、同一マシン上）: tmp/uiux-triage-2026-09-11/ の inventory.md（タスク→コミット→ファイル、依存関係）、design-review.md（タスク別判定表）、perf.md（計測表と起動中サーバー）、rejections.md（没案記録の調査）、cards/*.json（判定シートの元データ）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 判定シートの verdicts が36件すべて埋まっていることを read_db で確認し、結果一覧を本タスクの実装メモに転記している
- [ ] #2 verdict=drop のタスクは取り込まず、その理由が docs/design-system.md の「見送ったUI案」節に1行ずつ記録されている
- [ ] #3 verdict=fix のタスクは直す内容を子タスクとして起票し、修正込みで取り込まれている
- [ ] #4 verdict=keep/fix のタスクだけを含む統合ブランチが master から組み直され（または feat/ui-ux-update から revert で削られ）、基盤タスクの依存順（428.21→428.17、428.23→437、428.12→436、428.2/428.20→431/440）が崩れていない
- [ ] #5 428.22・432 を残す場合、実データ規模でライブラリ表示時の集計クエリ束を計測し、結果を実装メモに記録している
- [ ] #6 統合ブランチで pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
取り込み方の目安: drop が少数なら feat/ui-ux-update 上で revert、多数なら master から新統合ブランチに基盤→派生の順で cherry-pick。frame-c.css と LibraryView.tsx は5〜6タスクが同時に触るため片方だけ残すと辻褄が合わない。共通基盤は残して派生の見た目だけ戻す分解が要る場合がある。

未確認の観察: 428.16/436 検証中に、ある作品フォルダーでEnd押下後にリスト本文が空白のまま戻らない現象（再読み込みで復帰、再現条件未特定、どちらの版か未確認）。435 の AC#4（errorsシナリオでDataIntegrityWarningBanner表示）は未確認。428.1 は棚卸し表で判定不能とされたが f76a759 で実装済み。

環境: 比較用サーバーが起動中（master 4311/4321/4331・ブランチ 4312/4322/4332・4333/4334、シナリオ large/new-work/errors、worktree .worktrees/perf-master と .worktrees/perf-uiux、本番ビルド済み）。fixture状態は検証で汚れている（genre prefix削除、スマートフォルダー「空テスト」追加）ので再起動すれば戻る。worktreeの削除はユーザーが行う。
<!-- SECTION:NOTES:END -->
