---
id: TASK-509
title: カバー計測・stat・audio配信を作品ルートへの封じ込めと通常ファイル検査に揃え、idle timeoutの無効化を応答確定後にする
status: Done
assignee:
  - '@sonnet'
created_date: '2026-10-18 13:36'
updated_date: '2026-11-07 10:55'
labels:
  - security
  - server
dependencies:
  - TASK-506
priority: medium
ordinal: 567000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン外でCodexが見つけた封じ込め漏れ。scanRegister.ts:126 の measureCover(join(mediaRoot, meta.coverImage)) と coverDto.ts:12 の statSync(join(placement.mediaRoot, coverImage)) は、検証のない meta.coverImage（shared/src/meta.ts:26）を封じ込めずに使い、外部ファイルの計測・statが起きる。audio配信（coverMediaMethods.ts:109）だけ封じ込め後の通常ファイル検査がない。routes/media.ts:19 は検証・ファイル解決より前にidle timeoutを無効化している。文字列で .. を拒否するだけではsymlinkを防げないので、配信側と同じ resolveWithin（realpathベース）を使う。方針の正は CLAUDE-SECURITY-20261016-133939/fix-instructions.md の E。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン登録のカバー計測は、作品のmediaRootを基準にresolveWithinで封じ込めて通常ファイルと確認できたものだけを計測し、外に出るもの・通常ファイルでないもの（FIFO、デバイス、ディレクトリ）はカバーなしとして扱う
- [x] #2 coverDtoのカバー元stat（statCoverSource）も同じ封じ込めと通常ファイル検査を通し、外れるものはカバーなしになる
- [x] #3 audio配信が、workspace・coverの配信と同じく封じ込めの後に通常ファイルの検査をする
- [x] #4 テストで、coverImageが ../ ・絶対パス・ルート外へのsymlink・FIFOの場合にカバーなしになること、audioの非通常ファイルが拒否されること、検証失敗時にidle timeoutが無効化されないことを確認している
- [x] #5 media routeのidle timeout無効化は検証とファイル解決が済んだ後にだけ行う。workspace・audio配信は200/206の応答確定後、カバー配信は304判定の後かつサムネイル生成（materialize）の前に無効化し、長時間再生とサムネイル生成中の接続が維持される（既存のmediaIdleTimeoutテスト）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
共通関数 resolveRegularFileWithin(paths.ts)を新設し、スキャン計測・statCoverSource・カバー配信・audio配信で共用。封じ込め外/非通常ファイルはcoverErrors+=1(既存の計測失敗と同扱い)、DTOはcover:null。idle timeout無効化はレスポンス確定後(200/206のみ)に移動。

レビュー判断: 封じ込めと通常ファイル検査を同期の resolveRegularFileWithin に一本化したため、coverSnapshotの gap理由 cover-stat-failed は到達不能になり cover-path-unresolved に統合した。stat失敗のテストはディレクトリを置いて通常ファイルに解決できない形へ置き換え、「gapがあればサムネイルキャッシュを削除しない」保証は維持。cover配信はmaterialize前、workspace/audioは200/206確定後にidle timeoutを無効化する。一覧DTOでのrealpath増加はローカルFSでは誤差として対応なし。

マージ前レビュー(2026-11-07, Fable/Codex): カバー配信の無効化がmaterialize前である点をAC#5の文言に反映（サムネイル生成が長時間化しうるため実装を正とした）。統合ブランチで pnpm check && pnpm test・smoke 31件 通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
カバー計測・coverDtoのstat・カバー/audio/workspace配信を resolveRegularFileWithin（作品ルートへのrealpath封じ込め＋通常ファイル検査）に一本化し、idle timeoutの無効化を検証後に移した。pnpm check && pnpm test と smoke で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
