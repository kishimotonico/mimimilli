---
id: TASK-469
title: root変更を再設定ワークフローに置き換える
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - settings
  - scan
  - architecture
dependencies: []
priority: high
ordinal: 523000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/specification-review-2026-09-20.md S1。ユーザー決定（2026-09-24）: Astra案の再設定ワークフローを採用する。

現状: TASK-459（Done, `f9a49a8f`）はS1のうち「候補除外・候補sessionの破棄」だけを実装済み。再設定ワークフロー本体（操作ロック、検証→構築、画面初期化、失敗時のエラー・再試行）は未実装のまま。

現在のコード根拠:
- server/src/adapters/real/settingsScanMethods.ts（root_folder更新）
- client/src/app/App.tsx（変更直後の無効化）
- client/src/features/files/model/filePlayback.ts（未登録再生キューのroot相対パス解決）
- client/src/features/player/model/playerRuntime.ts
- server/src/adapters/real/coverMediaMethods.ts

採用するワークフロー（ユーザー決定）:
1. root変更を開始する前に、再生と実行中の管理ジョブを終了する。
2. 再設定中は通常のLibrary/Files操作を閉じる。
3. 対象rootを検証し、そのrootに対応するcatalog・候補を構築する。
4. 成功後に画面のquery・選択・候補状態を初期化して通常利用へ戻る。失敗時は再設定画面でエラーと再試行を扱う。

同じWork UUIDのuser状態を保持する方針は維持する。新rootからcatalogを再構築した結果、旧rootだけに存在した作品はcatalog一覧から外れるが、user状態は残す。段階切替・世代管理（旧rootを利用しながら新rootを準備する等）は作らない。rootだけ先に変えてFilesを閲覧する操作、切替をまたぐ再生は廃止する。

範囲外: 複数ライブラリの並行管理（library registry）、旧世代メディアlease。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 子タスク(S1.1・S1.2)がすべて完了している
<!-- AC:END -->
