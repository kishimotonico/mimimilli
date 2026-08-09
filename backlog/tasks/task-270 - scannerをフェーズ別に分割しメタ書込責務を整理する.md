---
id: TASK-270
title: scannerをフェーズ別に分割しメタ書込責務を整理する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:32'
labels: []
dependencies:
  - TASK-261
priority: medium
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapters/real/scanner.ts（1072行）の構造整理。
- scan()（:446-664, 約220行）を walk→register→generate→finalize のフェーズ別privateメソッドへ分割
- registerMetaFile（:809-947, 約140行）を probe解決・検証・Work組立に分割
- :966-978/:1054-1069 registerFolderWork と generateMetaForFolder のMetaFile組立重複を共有化
- :684-687/:708-709 coverSatisfied判定のコピペを関数化
- :896-900 スキャナがRJ検出時に patchMetaFile でメタ書込している責務混在を meta.ts 側へ移す
- Codexレビュー反映: UpsertBatch（:333-378）は取消（add内checkAbort）・件数制御flush・user→catalog分離トランザクションを束ねるscan用unit-of-workであり、workRepo.upsertWork への単純移管ではこの3機能が失われる。repoへは移さず、scanUpsertBatch.ts 等scanner隣接のapplication serviceとして抽出する
- Codexレビュー反映: 通常scanはWorker内で動くため「同期I/Oがイベントループを塞ぐ」は主目的にならない。generateフェーズ（:246-313）の目的は「walk結果を再利用して追加のディレクトリ走査をなくす」に修正する
- トラックprobe+duration解決ループが scanner と workRepo:423-437 で重複 → probe.ts に共有（検証はscanner専用層に残す）
metaIdMigration呼び出し部はTASK-261の完了形（軽量重複ガード）を前提とする。repo境界を決めるTASK-269の後に実施する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scan() と registerMetaFile がフェーズ・責務別の関数に分割されていること
- [ ] #2 メタファイル書込が meta.ts 系に集約され、スキャナ本体は読取+DB更新に限定されていること
- [ ] #3 MetaFile組立・coverSatisfied・probe解決の重複が解消されていること
- [ ] #4 serverテストが通ること
- [ ] #5 generateフェーズが追加のディレクトリ走査をせずwalk結果を再利用していること
<!-- AC:END -->
