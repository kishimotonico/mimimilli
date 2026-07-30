---
id: TASK-70
title: Bun compile・SQLite永続化の実証スパイク（配布制約の確定）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 04:07'
updated_date: '2026-07-19 04:21'
labels: []
dependencies: []
documentation:
  - scripts/spike/bun-distribution/README.md
  - scripts/spike/bun-distribution/WINDOWS-SMOKE.md
  - docs/adr/0007-bun-distribution-runtime.md
modified_files:
  - scripts/spike/bun-distribution
  - docs/adr/0007-bun-distribution-runtime.md
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
- [x] #1 Windows x64向けexeを生成するスクリプトがあり、WSLから生成が通る
- [x] #2 採用するSQLiteドライバでDB作成・migration・再起動後読み込みが実証されている（テストまたはsmokeスクリプト）
- [x] #3 sharp・HTTPサーバー・DBドライバ・データ配置の判断がADRに記録されている
- [x] #4 Windows実機での起動確認手順が文書化されている（実機確認自体はユーザー実施）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 既存構成とBun環境を確認する
2. scripts/spike/bun-distribution にSQLite永続化と依存切り分け用エントリを隔離して実装する
3. bun:sqlite / better-sqlite3 の永続化とWindows x64 compileを実測する
4. 結果・採用判断をADRとWindows smoke手順へ記録する
5. pnpm check / pnpm testを通し、受け入れ条件とタスクを完了する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bun 1.3.14で検証。bun:sqliteはcatalog/user 2DB、ATTACH、migration、別プロセス再オープンに成功。Hono + Bun.serveもHTTP書き込み後の再起動読み込みに成功した。better-sqlite3はcompileできてもBun実行時にERR_DLOPEN_FAILED（未対応）。@hono/node-serverは動作するがResponse互換警告あり。sharpはLinux実行とWindows exe生成まで成功したがnative addon/DLLの単一exe内蔵は未実証のため外部配布と判断。Windows x64向け4 exeはWSLからPE32+生成を確認。pnpm check、pnpm test（server 154件、client 243件）通過。Windows実機確認はWINDOWS-SMOKE.mdの手順でユーザー実施。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bun配布スパイクを隔離実装し、bun:sqliteとBun.serveを採用する配布制約をADR-0007に確定した。Windows x64 exe生成、SQLiteのmigration・別プロセス再オープン・2DB/ATTACH、HTTP再起動永続化を実証。better-sqlite3、@hono/node-server、sharpを個別に切り分け、Windows実機smoke手順も用意した。pnpm checkとpnpm testは通過。
<!-- SECTION:FINAL_SUMMARY:END -->
