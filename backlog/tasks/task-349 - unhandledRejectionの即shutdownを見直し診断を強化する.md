---
id: TASK-349
title: unhandledRejectionの即shutdownを見直し診断を強化する
status: Done
assignee: []
created_date: '2026-08-17 16:13'
updated_date: '2026-08-17 17:04'
labels: []
dependencies: []
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-08-17のWindowsドッグフーディングで見つかった不具合（事象2）の修正。try/catchで捕捉済みのはずのfs ENOENT（thumbnailCache.tsのstatSizeOrNull内）がunhandledRejectionとして観測され、index.tsの unhandledRejection → shutdown(1) でプロセスが落ちた。高負荷再現テスト3種と精読でコード構造の欠陥は反証済みで、Bun 1.3.14（Windows）ランタイム側の誤検出が最有力仮説（未確定）。

検証済みの事実:
- formatError（server/src/lib/logger.ts:218-238）はstack・cause・suppressed対応済みだが、非Errorのreasonは String(reason) で "[object Object]" になる。fsエラーの code/errno/syscall/path も出ない
- 起動途中の例外でexit code 1に到達しない経路が実在する: ハンドラ登録（index.ts:85）〜 app初期化（index.ts:107、const）の間に例外が起きると、shutdown内80行目の { server, app, adapter } 評価で app がTDZのためReferenceErrorが同期throwされ（try/catchの外）、void shutdown(...)のrejectが再度unhandledRejectionになり、shuttingDownフラグで2回目は即returnしてprocess.exit未到達。穴はconstのappのみ（let宣言のadapter/serverはundefinedでも安全）
- performGracefulShutdown（serverLifecycle.ts:11-30）は各段階try/catchで握り潰す構造。shutdown側のperformGracefulShutdown呼び出し（index.ts:80）はtry/catchの外
- Bun: 2026-08-18時点のlatest stableは1.3.14で更新先なし。リリースノートに該当修正なし。調査中に挙がったissue番号（#37474等）は実在未確認なので、ADRへ引用する前に再確認が必要

実装方針:
- 終了ポリシーはADRで決定してから実装する。比較する選択肢: 一律ログのみで継続 / Windows限定で継続 / 短時間に反復したら終了 / 現状維持。推奨はログのみで継続（自動再起動が無い環境で1発のランタイム誤検出がサーバー全体を落とすのは過酷）。ログ洪水対策（同一原因の集約・件数記録）もADRで扱う
- ログ整形の耐性強化は「非Errorのreasonの型と内容が判別できる」「fsエラーのcode/syscall/pathが出る」まで。循環参照・Proxy等への網羅的な防御は不要
- 整形処理とprocessイベント登録は副作用のない関数に切り出してテスト可能にする
- uncaughtExceptionは従来どおりshutdown(1)を維持しつつ、起動途中でも確実にexitできるようにする（appのTDZ解消、performGracefulShutdown失敗時もfinallyでexit）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 unhandledRejection発生時、reasonの型と内容（非Error・falsyでも判別可能）、stack・cause・suppressed、fsエラーのcode/syscall/pathを含む構造化ログが残る
- [x] #2 unhandledRejection時の終了ポリシーを選択肢比較つきのADRとして記録し、決定した動作（継続/終了の条件）が実装・テストされている
- [x] #3 uncaughtExceptionではshutdown(1)が維持される
- [x] #4 起動途中（app初期化前）に例外が起きてもexit code 1で終了する（shutdownのTDZ参照解消、クリーンアップ失敗時もexit到達）。起動途中・起動完了後の両方をテストで確認する
- [x] #5 Bunバージョン更新の要否の結論（2026-08-18時点で1.3.14がlatest stable・該当修正なし）と、引用するissue番号の実在確認結果をADRまたはタスクノートに記録する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ADR-0022にBun 1.3.14 latest・該当修正なし、issue #37474/#13456の実在確認と症状との関係を記録済み。本文は未改変。
<!-- SECTION:NOTES:END -->
