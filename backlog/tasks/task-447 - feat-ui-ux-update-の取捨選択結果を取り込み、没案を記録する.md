---
id: TASK-447
title: feat/ui-ux-update の取捨選択結果を取り込み、没案を記録する
status: To Do
assignee: []
created_date: '2026-09-10 18:05'
updated_date: '2026-09-11 00:43'
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

判定結果（2026-09-11、Artifact DBから読み取り、tmp/uiux-triage-2026-09-11/verdicts.json にも保存）: 残す19 / 直す10 / 戻す7。
- 残す: 428.2, 3, 7, 10, 11, 12, 13, 17, 20, 23, 24, 432, 433, 434, 435, 436, 437, 439, 440
- 直す: 428.1, 5, 6, 8, 9, 14, 16, 18, 19, 431（理由は verdicts.json）
- 戻す: 428.4, 15, 21, 22, 429, 430, 438

追加報告3件の原因（tmp/uiux-triage-2026-09-11/{flicker,gridsize,button-impact}.md）:
- 作品詳細表示時のちらつき・詳細選択中のグリッド縮小（6列→4列）はどちらも TASK-438 cadbf04（プレビューを実レイアウトのflex項目にした）。438を戻せば両方消える。
- ボタン内文字の拡大は TASK-431 4384fce の text-[9px]→text-caption(10px) 丸め（TopBar.tsx:216、NotificationBell.tsx:100）。
- ゴミ箱アイコン・設定画面の丸ボタン過密は Button.tsx（428.21）ではなく TagPrefixSettings.tsx（428.7）と WorkStatusWarnings.tsx／ErrorViewBulkUnregisterBanner.tsx（428.5）のアイコン選択とIconButton多用が原因。428.21 の Button variant は 428.17（WorkEditDialog の danger）等5ファイル約20箇所が依存し、丸ごと戻すと壊れる。

ユーザー決定（2026-09-11）で判定を確定:
- 428.21 は「戻す」→「直して残す」に変更。Button.tsx の variant/size 定義は残し、ゴミ箱アイコン→バツ、丸ボタン（IconButton）の間引きを TagPrefixSettings.tsx（428.7）・WorkStatusWarnings.tsx／ErrorViewBulkUnregisterBanner.tsx（428.5）側で直す。ユーザー注記: 実機で再び違和感・ダサさがあればさらに戻す可能性あり。
- 428.15 は部分戻し。不正URLの自動復帰（libraryUrlRecovery.ts、LibraryView.tsx の復帰 useEffect、1b4ed1b と 1a8f63c の該当部分）だけ戻し、検索のEscape・パンくず改善は残す。404は404のまま見せる。
- 428.4 は部分戻し。要対応タブ・通知ベルのUI変更とサーバー機能（0414a51 スキャン完了時のDLsite一括enqueue、bf98af4 lastScanRootFolder）は残す。「ID重複（identityConflicts）時のUI」だけ master の表現へ戻す（該当箇所の特定は着手時に b7c6b51 の NeedsAttentionTab.tsx / needsAttention.ts 差分から行う）。
- 428.22 は戻す（軸の数字はタグ種類数だが区別できず、軸数×フォルダー数の全件集計を投げる構造のため）。これにより 428.14 の修正は値一覧側のみ。
- 438 を戻すことで、追加報告の「詳細表示時のちらつき」「詳細選択中のグリッド6列→4列」も解消する。

取り込み手順の確定案: feat/ui-ux-update から統合ブランチ feat/ui-ux-intake を切り、revert で削る。順序 438 → 429 → 430（428.9 の resultsBanner 集約が430前提なので整合確認）→ 428.22 → 428.4（ID重複UIのみ）→ 428.15（URL復帰のみ）。その後「直す」11件（428.1, 5, 6, 8, 9, 14, 16, 18, 19, 21, 431）を子タスクとして起票し委譲。最後に「戻す」理由を docs/design-system.md の「見送ったUI案」節へ1行ずつ。

体制: 統括は w1:p4 の Opus（後任）。前任（本セッション）はアドバイザーとして上位レビュー・相談・進行監視を担当。
<!-- SECTION:NOTES:END -->
