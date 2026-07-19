---
id: TASK-56
title: スキャンモーダルの導入（即時実行の廃止・前回結果表示・NewWorkPopup統合）
status: To Do
assignee: []
created_date: '2026-07-19 01:50'
updated_date: '2026-07-19 02:33'
labels: []
dependencies: []
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TopBarのスキャンボタンは現在押した瞬間に POST /api/scan が走るが、他のボタン（設定など）はモーダルを開く設計であり一貫性がない。スキャンボタンでモーダルを開き、そこから開始・進捗確認・結果閲覧ができるUIに改める。

設計方針（会話で合意済み）:
- スキャンモーダルは状態に応じて3つの顔を持つ: 開始前（前回結果サマリ + 最終スキャン日時 + スキャン開始ボタン）/ 実行中（フェーズ別進捗。useScanProgress を流用）/ 完了後（統計バッジ・新規作品リスト・タイトル編集・RJ未検出導線 = 現 NewWorkPopup の内容を統合）
- NewWorkPopup は廃止してモーダルに完全統合する
- 完了時の自動ポップアップ（新規>0で勝手に開く挙動）は廃止。モーダルを開いていればそこに結果が出る。閉じていれば通知ベルに任せ、フォーカスを奪わない
- 前回スキャン結果のディスク永続化はしない。server/src/routes/scanProgress.ts が SSE replay 用に保持している lastTerminalEvent（ScanResult 丸ごと）を GET /api/scan/last のような小さいエンドポイントで公開するだけにする。最終スキャン日時は既存の settings.lastScanTime（永続化済み）を使う。つまり開始前状態は「日時は再起動後も表示、結果サマリはサーバー起動後に一度でもスキャンしていれば表示」
  - 理由: ディスク永続化が追加で買えるのは再起動後の統計表示だけで、registered や rjCodeMissingCount はライブラリから導出可能、newlyGenerated/errors/missing は再起動をまたぐと鮮度が落ちる。保存基盤の追加に釣り合わない
- 実行中にモーダルを閉じてもスキャンは継続（バックグラウンド化）。TopBar の回転アイコン + 進捗ラベルは維持し、再度ボタンを押すと実行中モーダルに復帰
- 通知ベルの「直近のスキャン結果」サマリは残し、クリックでスキャンモーダルの結果表示を開く導線にする
- セットアップ完了時の自動スキャン（isCompletingSetup）はモーダルを出さない現状維持

関連ファイル: client/src/app/ui/TopBar.tsx, client/src/features/scan/（model.ts, useScanProgress.ts, ui/NewWorkPopup.tsx）, client/src/app/App.tsx, shared/src/scan.ts, server/src/routes/scan.ts, server/src/routes/scanProgress.ts。モーダルは <dialog> + useDialogModal パターン、見た目は docs/design-system.md に従う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャンボタン押下でスキャンは開始されず、スキャンモーダルが開く
- [ ] #2 モーダル内からスキャンを開始でき、実行中はフェーズ別進捗が表示される
- [ ] #3 スキャン完了時、モーダルが開いていれば結果（統計・新規作品リストとタイトル編集・RJ未検出導線）が表示される
- [ ] #4 実行中にモーダルを閉じてもスキャンは継続し、TopBarに進捗が出る。再度ボタンを押すと実行中の表示に復帰する
- [ ] #5 NewWorkPopup が削除され、完了時にフォーカスを奪う自動ポップアップが発生しない
- [ ] #6 通知ベルの直近スキャン結果クリックでスキャンモーダルの結果表示が開く
- [ ] #7 pnpm check と pnpm test が通る
- [ ] #8 モーダルの開始前状態に最終スキャン日時（lastScanTime）が表示され、サーバー起動後に一度でもスキャンしていれば前回結果のサマリも表示される（ページをリロードしても消えない）
<!-- AC:END -->
