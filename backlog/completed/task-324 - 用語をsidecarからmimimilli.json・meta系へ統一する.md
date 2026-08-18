---
id: TASK-324
title: 用語をsidecarからmimimilli.json・meta系へ統一する
status: Done
assignee: []
created_date: '2026-08-13 16:57'
updated_date: '2026-08-14 07:44'
labels: []
dependencies: []
priority: high
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14の決定。ADR-0010「meta-file-rename-mimimilli-json」で作品メタデータファイルの呼称は決定済みで、コードの主流もmeta/metaFile/metaPath系だが、ADR-0017とその関連機能で「sidecar」が定義なく持ち込まれ、UI文言（ScanReview.tsx:186「不正なsidecar N件」）にまで漏れている。少数派を既存の多数派へ戻す。用語方針: ファイルそのものを指すときはmimimilli.json、機能名・説明文では作品情報／作品情報ファイル、コード識別子はmeta系。sidecarは使わない。ADR-0001・0007のsidecarはTauri/Node.jsのプロセスsidecarで別概念のため対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 shared/src/scan.tsのinvalidSidecars・InvalidSidecar・invalidSidecarSchemaがinvalidMetaFiles・InvalidMetaFile・invalidMetaFileSchemaへ改名され、HTTP/SSEの応答も追従している
- [x] #2 server側のmoveSidecars・restoreSidecars・movedSidecars（databaseReplacement.ts）とscanInvalidSidecars（fixture）がmeta系の名前になっている
- [x] #3 meta.ts:121のエラーメッセージが「作品情報の復元に失敗しました」になっている
- [x] #4 docs/adr/0017がファイル名を0017-meta-source-projection-and-work-identity.mdへ変更され、他ADR・backlogからの参照も追従している
- [x] #5 ADR-0017の冒頭に用語定義（メタデータ正本ファイルはmimimilli.json、コード識別子はmeta系）が明記されている
- [x] #6 docs/application-architecture-review-2026-08-12.mdとbacklogタスク本文のsidecar表記が置換されている（ADR-0001・0007は除く）
- [x] #7 client/src・server/src・shared/srcにmimimilli.jsonを指す意味でのsidecarが残っていない
- [x] #8 ADR-0017のファイル名変更をgit mvで行い、リネーム履歴が追跡できる
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
shared/src/scan.tsのinvalidSidecars系をinvalidMetaFilesへ改名しHTTP/SSE契約を追従させた。databaseReplacementのsidecar系はSQLiteのWAL/SHM補助ファイルという実体に合わせWalShm系へ改名。ADR-0017をgit mvで0017-meta-source-projection-and-work-identity.mdへリネームし、冒頭に用語定義（メタデータ正本ファイルはmimimilli.json、コード識別子はmeta系）を追記。docs・backlog本文のsidecar表記も置換（ADR-0001・0007は意図的に除外）。その後TASK-321で新規混入したsidecar識別子も追って改名し用語を統一した（a21f68c）。verified: pnpm check && pnpm test、client/src・server/src・shared/srcにmimimilli.jsonを指すsidecarが残っていないことをgrepで確認。
<!-- SECTION:FINAL_SUMMARY:END -->
