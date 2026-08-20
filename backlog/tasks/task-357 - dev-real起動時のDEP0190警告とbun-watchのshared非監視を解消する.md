---
id: TASK-357
title: 'dev:real起動時のDEP0190警告とbun --watchのshared非監視を解消する'
status: Done
assignee:
  - '@fable'
created_date: '2026-08-20 15:11'
updated_date: '2026-08-20 15:29'
labels: []
dependencies: []
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windowsでの pnpm dev:real 起動時に2つの問題がある。

1. DEP0190 DeprecationWarning: scripts/dev-real.mjs:96-101 が Windows で shell:true + args配列 の spawn をしており、Node本体の非推奨パターンに該当。cross-spawn への置き換えで解消する（cross-spawnはWindowsの.cmdシム解決をshell:trueなしで行う）。client側にも同警告が出るがpnpm内部起因のため対象外。
2. bun --watch の「is not in the project directory and will not be watched」警告: server/ をcwdに bun --watch src/index.ts を実行しているため、workspace依存の shared/src/*.ts が監視対象外。警告だけでなく、shared編集時にserverが自動再起動しない実害がある。cwdをリポジトリルートにして bun --watch server/src/index.ts とする案が有力だが、cwd相対のパス解決（server/src/adapters/real/dataRoot.ts 等、dev-real.mjsの作業ディレクトリ判定含む）への影響確認が必要。

Windows実機は別PCのため、Windows固有の受け入れ条件は最終的にユーザーが実機確認する。実装時はWSLで検証できる範囲（fixtureアダプタでの起動・watch挙動・テスト）を確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/dev-real.mjs のspawnがshell:true+args配列パターンでなくなり、Windowsの pnpm dev:real でDEP0190（server側起因分）が出ない
- [x] #2 bunの not watched 警告が出ず、shared/src/*.ts の編集でserverプロセスが自動再起動する（WSLのfixtureアダプタで確認）
- [x] #3 cwd変更後もrealアダプタのデータディレクトリ解決とdev-real.mjsの作業ディレクトリ判定が従来どおり動作する
- [x] #4 WSLの pnpm dev / pnpm dev:fixture:new-work が引き続き起動する
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
bunの--cwdフラグはentry point解決のみでwatchのtop_level_dirには効かないことを実験で確認済み。OSプロセスcwd自体をrepoRootにする必要があった。portlessのcwdをrepoRootに変えるとserver/package.jsonのportlessフィールド（api.mimi）解決が壊れるため、run-server-watch.mjsでbunだけを別cwd起動する設計。レビュー（Sonnet）で報告外の副作用なしを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
dev-real.mjsのshell:true+args配列spawnをcross-spawnヘルパー（scripts/lib/spawnAndForward.mjs）へ置き換えDEP0190を解消。serverのdev系スクリプトをscripts/run-server-watch.mjs経由にし、bunをリポジトリルートcwdで起動してshared/srcをwatch対象化（shared編集時の自動再起動が復活）。WSLのfixtureアダプタで起動・watch再起動・API応答を実機確認、pnpm check/test全通過。Windows実機でのDEP0190消滅はユーザーの実機確認待ち。
<!-- SECTION:FINAL_SUMMARY:END -->
