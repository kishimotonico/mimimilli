---
id: TASK-511
title: スキャン画面とDLsite連携を作り直す
status: Done
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 07:31'
labels:
  - scan
  - dlsite
dependencies: []
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
priority: high
ordinal: 569000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-11-08のドッグフーディングで出たスキャン・DLsite連携の問題（取得待ちのまま進まない、取得後にカバー・タイトルを反映できない、ベルのまとめて取得が既存の全作品へHTTPを出す、apply-missingのエラー、モーダルと件数の分散）を根本から作り直す。決定内容は ADR-0033（DLsite情報は登録前に明示取得し、追加を承認とする）と ADR-0034（スキャン画面は今回のスキャンで見つかったものだけを扱う）が正。触れるモック: https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k （Version 11、所有者のみ閲覧可。参考であり、決定と文言の正はADRと各子タスクの本文）。

統合ブランチは feat/scan-dlsite-redesign。子タスクごとにworktreeを切り、統合ブランチへfast-forwardで集約する（AGENTS.md）。

進め方の原則: サーバー契約を変える子タスクは、そのタスクの中で既存クライアントの呼び出し元を追随・削除まで行う。互換レイヤーは作らない。各子タスクの完了時点で pnpm check・pnpm test が通る。

順序: 511.1 → 511.2 → 511.3 → 511.6。TASK-448.4 → 511.4 → 511.11 → 511.5。511.6 → 511.7 → 511.12（ScanModal・ScanSidebarの衝突を避けるため直列）。511.8 は 511.1・511.6・511.7・511.12 の後。511.9 は 511.3・511.8 の後。511.10 は最後。

統合ブランチ内の一時状態: 511.1 から 511.6 までのあいだはまとめて取得するUIがなく、新規作品タブの「取得待ち」表示は 511.7 まで残る。どちらも統合ブランチ内だけの状態として許容する。

関連:
- TASK-448.3（DLsite SSEのroute切り出し）: heartbeatは511.1で吸収する。448.3の残りは511.1の後に判断する。
- TASK-448.4（finalizeScanの経路一本化）: 統合ブランチ feat/scan-dlsite-redesign 上で、511.4 の前に行う（511.4が依存）。
- DRAFT-72（スキャン判断ロジックのcore抽出と単体テスト化、次のスキャン大改修時に実施）: 511.4で変化の種類の判定をcoreに抽出し単体テスト化することで扱う。511.4の完了時にDRAFT-72の扱いを決める。
- DRAFT-70（要対応の遷移先をライブラリのエラービューへ一本化）: ADR-0034で要対応の推奨アクションをスキャン画面の中で完結させたため、遷移先の一本化は不要になった。エラービューの種類絞り込みの論点は残るので、ドラフトは残す。
- DRAFT-75（行方不明作品の除外フラグと再登録ブロック）: 511.11の「今回新たに行方不明」と511.12の登録解除に関係する。除外フラグは本タスクの範囲外。
- DRAFT-73（smokeのFixtureStateリセットがジョブ履歴を初期化しない）: 511.1でDlsiteJobManagerの状態が変わるので、smokeが不安定になったらここを見る。
- DRAFT-53（作品の一括選択・一括操作）: ADR-0033の「将来のライブラリ選択＋右クリック」の受け皿。本タスクの範囲外。
- DRAFT-76（DLsite一括取得の運用）: 全件取得と管理ビューの廃止で前提がなくなったためアーカイブした。
- DRAFT-77（行方不明の作品と同じRJコードの候補を引き継ぐ操作の契約）: 引き継ぐ操作はここで決めてから子タスクを足す。本タスクでは行で知らせるまで。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 子タスクがすべて完了している
- [x] #2 統合ブランチ全体の最終レビューを通し、masterへ--no-ffでマージしている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
行方不明の作品と同じRJコードの候補を引き継ぐ操作は契約が未決のため DRAFT-77 に分けた（ADR-0034）。決まったら子タスクを追加する。

2026-11-19: DRAFT-72はTASK-511.4で変化の種類判定をcore（server/src/core/workChanges.ts）へ抽出して単体テスト化した。分類・重複判定・メタ差分マージ等の残りがあるため、ドラフトは残す。

2026-11-19（TASK-511.9のレビューより）: 作品情報ファイルの書き込み（patchWorkSource・updateDlsiteState・作品詳細の適用など、mutateMetaSource 経由の全経路）は catalog の metaPath を root で封じ込めないので、登録後に作品フォルダーをルート外を指すsymlinkへ差し替えると、その先の mimimilli.json を書き換える。スキャンはsymlinkのディレクトリを追従せず、Filesの登録も resolveWithin で弾くため、成立にはユーザー自身のローカル操作が要る。TASK-510 と同じ根拠（影響がローカル操作に閉じる）で対応なしとした。511.9以前は applyCover=true のときだけカバー確定の resolveWithin が偶然弾いていた。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
子タスク12本（511.1〜511.12）とTASK-448.3・448.4を feat/scan-dlsite-redesign に集約し、最終レビュー（Fable）の是正を経て master へ --no-ff でマージした（b2438b8c）。DLsite取得は登録前の明示ジョブ、追加が承認、作品詳細は差分確認で適用、DLsite情報はサーバーがキャッシュから読む。スキャン画面は未登録・新規作品・要対応・更新済みの4タブで今回のスキャン結果だけを扱い、ベル・通知・まとめて適用を廃止した。作品情報ファイルの書き込みがルート外symlinkを封じ込めない既存の穴は対応なし（notesに根拠）。
<!-- SECTION:FINAL_SUMMARY:END -->
