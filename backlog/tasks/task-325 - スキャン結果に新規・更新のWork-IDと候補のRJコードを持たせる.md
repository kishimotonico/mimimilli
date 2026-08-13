---
id: TASK-325
title: スキャン結果に新規・更新のWork IDと候補のRJコードを持たせる
status: To Do
assignee: []
created_date: '2026-08-13 16:58'
labels: []
dependencies: []
priority: high
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー2026-08-14。スキャンモーダル再構成の前提となるサーバー側の対応。現状の問題: (1) real adapterでnewlyGeneratedは常に0、newWorkIdsは常に空配列のまま（scanner.ts:133,136で初期化されたきり）。TASK-318で自動登録を廃止した際に埋める処理が失われ、UIだけが残っている。(2) メタファイルが更新された作品はregisteredカウントに埋没し、どれが更新されたか識別できない。registeredの実体は「新規＋更新＋復帰」の合計でラベルと合っていない。(3) ScanCandidateにRJコードのフィールドがなく、登録前に検出結果を確認・修正できない（検出はdetectRjCode([basename, title])で登録時に行われる）。仕様: mimimilli.jsonがあるフォルダーの新規登録は従来どおりユーザー確認なしで行う（正本が作品と宣言済みのため。ADR-0017の原則と一致）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ScanResultに今回カタログへ新規挿入されたWork IDの配列が含まれ、候補承認による登録分と自動登録分の両方を識別できる
- [ ] #2 ScanResultにメタファイル更新により再投影されたWork IDの配列が含まれる
- [ ] #3 ScanCandidateにフォルダー名から検出したRJコード（未検出はnull）が含まれる
- [ ] #4 候補の登録APIがRJコードの指定を受け付け、指定された値がmimimilli.jsonへ書き込まれる（未指定・空は従来どおり自動検出）
- [ ] #5 常に0/空になっていたnewlyGenerated・newWorkIdsが廃止または実データを返すよう修正されている
- [ ] #6 新規・更新・スキップの分類を検証するテストがある
<!-- AC:END -->
