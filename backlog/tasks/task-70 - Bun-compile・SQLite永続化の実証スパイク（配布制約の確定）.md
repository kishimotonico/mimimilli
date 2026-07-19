---
id: TASK-70
title: Bun compile・SQLite永続化の実証スパイク（配布制約の確定）
status: To Do
assignee: []
created_date: '2026-07-19 04:07'
labels: []
dependencies: []
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(doc-1)指摘2と優先順位レビュー(2026-07-19)より。DRAFT-27のDB設計・DRAFT-1の配布を進める前に、配布ランタイムの制約を実証して確定する。後からSQLiteドライバを差し替えるとDB層を二度作ることになるため最初に置く。

やること:
- bun build --compile でserver（+client成果物の埋め込み or 配信方式の決定）のWindows x64向けexeを生成するスクリプトを整備
- SQLiteドライバ候補（bun:sqlite / better-sqlite3のBun互換性）でDB作成・migration実行・再起動後の読み込みを実証。catalog/user 2DB想定の接続方式も確認
- sharp・@hono/node-serverの扱い（残す/置換）を判断し、結果をADRに記録（docs/adr/ の番号は作成直前に確認）
- exe配置場所と無関係なユーザーデータディレクトリの決定（作業ディレクトリ相対の現状DBパスは配布で事故る）

WSL内ではWindows exeの実行確認ができないため、生成物と実行手順を用意し、Windows実機での起動・DB再オープン確認はユーザーに依頼する（受け入れ条件として明記）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Windows x64向けexeを生成するスクリプトがあり、WSLから生成が通る
- [ ] #2 採用するSQLiteドライバでDB作成・migration・再起動後読み込みが実証されている（テストまたはsmokeスクリプト）
- [ ] #3 sharp・HTTPサーバー・DBドライバ・データ配置の判断がADRに記録されている
- [ ] #4 Windows実機での起動確認手順が文書化されている（実機確認自体はユーザー実施）
<!-- AC:END -->
