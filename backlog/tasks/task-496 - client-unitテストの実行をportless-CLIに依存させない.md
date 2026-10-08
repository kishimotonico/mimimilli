---
id: TASK-496
title: client unitテストの実行をportless CLIに依存させない
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:48'
updated_date: '2026-10-08 04:12'
labels:
  - client
  - test
  - tooling
dependencies: []
documentation:
  - backlog/docs/doc-7
priority: medium
ordinal: 554000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/vite.config.ts は defineConfig のコールバックで server.proxy を即時に組み立て、MIMIMILLI_BACKEND_URL が無いと execFileSync("portless", ["get", ...]) を実行する。vitestの設定は同じ vite.config.ts の test キーにあるため、vitest run でもこの評価が走り、unitテストがportless CLIの有無に左右される。vitestの設定を分けるか、proxyの解決をdev server起動時だけにする。portlessとの連携はscriptsの起動ラッパーから環境変数で渡す形に寄せ、vite.config.ts は環境変数だけを見る。Windowsネイティブ（shell:true分岐）でも同じに動くこと。詳細は doc-7 の tool-4。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 portlessがPATHに無い環境でclientのunitテストが通る
- [x] #2 vite.config.tsがportless CLIを直接呼ばない
- [x] #3 dev起動（pnpm dev・dev:fixture系）でAPIのproxy先がこれまでどおり解決される
- [x] #4 pnpm check && pnpm test が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
vite.config.ts は MIMIMILLI_BACKEND_URL だけを見て serve 時のみ proxy を組み立て、vitest 設定を vitest.config.ts に分離。portless の解決は scripts/dev-client.mjs が行う。portless 無しの PATH で client unit テスト通過を実測。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
