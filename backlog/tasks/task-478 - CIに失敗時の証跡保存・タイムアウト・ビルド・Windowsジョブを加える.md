---
id: TASK-478
title: CIに失敗時の証跡保存・タイムアウト・ビルド・Windowsジョブを加える
status: In Progress
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 04:12'
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
- [x] #1 smoke失敗時にreportとtraceがartifactとして保存される
- [x] #2 各ジョブにtimeout-minutesが設定され、同一ブランチの古い実行がconcurrencyで取り消される
- [x] #3 CIでclientのプロダクションビルドが実行される
- [ ] #4 Windowsランナーでpnpm check && pnpm test が実行される
- [x] #5 rootにpackageManagerが宣言されている
- [x] #6 列挙した死んだ設定・常にno-opのskipが取り除かれ、oxlintがscriptsとserver/benchも対象にする
- [ ] #7 Windowsジョブでserverのreal-testsが並列実行され、temp・DB削除のEBUSYなしで通る（TASK-345で残っていたWindows実機確認をここで担う）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: Windowsジョブ（AC#4）では、POSIX前提のテスト（rootReconfigurationContract・scannerUnreadable・workUnregisterのchmodSync(0o000)、staticServeのsymlinkSync）はプラットフォーム条件付きのskipに理由を添えて整理する。smokeのWindows対応（fixtures.tsの spawn("pnpm") や負PIDのkillGroup）は効果に比べて範囲が大きいので対象外とし、smokeはLinuxのCIのみでよい（doc-7 tool-1）。本番ビルド（AC#3）は点検でも確認済み（doc-7 tool-2）。

2026-10-08 Windowsジョブ（check-and-test-windows）を追加し、POSIX前提のテスト（chmod 000・symlink）にwin32 skipを理由付きで入れた。AC#4・#7はpush後のCIで確認が必要なため未チェック。初回が落ちたら scripts/*.test.mjs のパス区切り依存をまず疑う。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
smoke 失敗時の report/trace 保存、全ジョブの timeout-minutes と concurrency、client ビルド、Windows ジョブ、packageManager、死んだ設定の整理を実装し 17736da3 で master へマージ。AC#4・#7（Windows ジョブの実行）は push 後の CI で確認するまで In Progress のまま。
<!-- SECTION:FINAL_SUMMARY:END -->
