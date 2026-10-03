---
id: TASK-478
title: CIに失敗時の証跡保存・タイムアウト・ビルド・Windowsジョブを加える
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
updated_date: '2026-10-02 11:50'
labels:
  - ci
  - test
dependencies: []
priority: medium
ordinal: 536000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検でCI（.github/workflows）の不足が見つかった: smoke失敗時のplaywright report/traceをuploadしていない、timeout-minutesとconcurrency未設定、vite buildがどこでも走らない、Windowsネイティブ動作は恒久要件なのにWindowsジョブが無くTASK-345のEBUSY系を検出できない、rootのpackage.jsonにpackageManagerが無い。あわせて死んだ設定: scripts/spike/bun-distribution（node_modulesだけ）、client/package.jsonのdev:real（devと同一）、smokeの test.skip(project !== desktop-chromium) 3件（projectが1つで常にno-op）、.oxlintrc.jsonのreact.versionハードコード、oxlintがscriptsとserver/benchを対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smoke失敗時にreportとtraceがartifactとして保存される
- [ ] #2 各ジョブにtimeout-minutesが設定され、同一ブランチの古い実行がconcurrencyで取り消される
- [ ] #3 CIでclientのプロダクションビルドが実行される
- [ ] #4 Windowsランナーでpnpm check && pnpm test が実行される
- [ ] #5 rootにpackageManagerが宣言されている
- [ ] #6 列挙した死んだ設定・常にno-opのskipが取り除かれ、oxlintがscriptsとserver/benchも対象にする
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: Windowsジョブ（AC#4）では、POSIX前提のテスト（rootReconfigurationContract・scannerUnreadable・workUnregisterのchmodSync(0o000)、staticServeのsymlinkSync）はプラットフォーム条件付きのskipに理由を添えて整理する。smokeのWindows対応（fixtures.tsの spawn("pnpm") や負PIDのkillGroup）は効果に比べて範囲が大きいので対象外とし、smokeはLinuxのCIのみでよい（doc-7 tool-1）。本番ビルド（AC#3）は点検でも確認済み（doc-7 tool-2）。
<!-- SECTION:NOTES:END -->
