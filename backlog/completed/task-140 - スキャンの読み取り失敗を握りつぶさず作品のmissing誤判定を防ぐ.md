---
id: TASK-140
title: スキャンの読み取り失敗を握りつぶさず作品のmissing誤判定を防ぐ
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:32'
updated_date: '2026-07-30 16:00'
labels: []
dependencies: []
priority: high
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン中のディレクトリ読み取り失敗が無防備にmissing判定へ流れ、正常な作品がUIから消える（敵対的検証済み・Codexレビュー指摘#1）。

事実:
- server/src/adapters/real/scanner.ts:108-113 walk()のreaddir失敗はconsole.warnして continue するだけ。ルート自体が読めない場合（マウント切断等）もwalk()は空結果で正常終了する
- scanner.ts:544 が seenIds 外を無条件に markMissingExcept し、workRepo.ts:1367-1371 に防御なし。ルート切断時は全作品が一括missing化する
- 付随: findCoverImage（scanner.ts:185-191）と collectAudioRecursive（scanner.ts:203-213）は同種の失敗を無警告で握りつぶす（catch { return null } / catch { continue }）。兄弟コード108-113はwarnを出しており非対称。特にcollectAudioRecursiveはwalk()未検証のサブフォルダーを再帰する現実的な失敗経路

方向:
- ルートのreaddir失敗はスキャン全体をエラーにする（missing更新へ進まない）
- サブツリーの読み取り失敗は読取不能prefixを記録し、その配下をmissing判定から除外して部分結果として報告する
- findCoverImage/collectAudioRecursiveにconsole.warnを追加（挙動自体はベストエフォート継続で維持）

関連: TASK-95（スキャンerror固着・強制フルスキャン）と同領域だが別問題。SoTは.meta.jsonなのでデータ自体は失われないが、UIから作品が消える実害がある。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ルートフォルダーが読めない場合、スキャンがエラーで終了しmissing更新が実行されない
- [x] #2 サブツリーの読み取り失敗時、その配下の既存作品がmissing化されず、失敗がスキャン結果に報告される
- [x] #3 findCoverImage/collectAudioRecursiveの読み取り失敗が警告ログに残る
- [x] #4 pnpm check・pnpm test:server が通り、上記の回帰テストがある
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ルートreaddir失敗はスキャン全体をエラー終了させmissing更新へ進まない
2. サブツリー失敗は読取不能prefixを記録しmarkMissingExceptの対象から除外、結果に報告
3. findCoverImage/collectAudioRecursiveへconsole.warn追加
4. 回帰テスト、pnpm check + pnpm test:server
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。ルート失敗はScanRootUnreadableErrorでスキャンfailed化、サブツリー失敗はunreadablePaths収集+配下の既存作品をseenIdsへ温存。ScanResultにunreadablePaths(optional)追加でclient非破壊。scannerUnreadable.test.ts(146行)追加。pnpm check(fmt含む)+test:server 341件+test:client 384件を統括側で確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャンの読み取り失敗をmissing誤判定から分離。ルート読取失敗はスキャン全体をエラーにし、サブツリー失敗は配下の既存作品をmissing対象から除外して結果に報告。findCoverImage/collectAudioRecursiveにも警告ログを追加。
<!-- SECTION:FINAL_SUMMARY:END -->
