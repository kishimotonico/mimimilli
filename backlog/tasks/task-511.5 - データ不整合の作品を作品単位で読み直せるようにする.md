---
id: TASK-511.5
title: データ不整合の作品を作品単位で読み直せるようにする
status: To Do
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 00:50'
labels:
  - scan
dependencies:
  - TASK-511.11
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: medium
ordinal: 574000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0034の要対応「データ不整合」の推奨アクション「この作品を読み直す」のためのサーバー側の入口を作る（作品単位の読み直しを用意することは決定済み）。

現状: catalog DBの値が壊れていると listSummaries がその作品を除外し（server/src/adapters/real/workQueryRepository.ts、PersistentDataError）、dataIntegrityWarning（shared/src/dataIntegrity.ts）で件数とWork IDを報告するだけ。直す手段は全件の読み直ししかない。catalogは作品情報ファイルの投影なので（ADR-0017）、その作品の作品情報ファイルから作り直す。

fixture: fixtureアダプタは dataIntegrityWarning のダミー（server/src/adapters/fixture/state.ts の DATA_INTEGRITY_WARNING_SKIPPED_WORK_ID、実在の works に含めない）を返している。読み直しの契約をfixtureでも満たし、smokeや画面確認で使えるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Work IDを指定して、その作品だけを作品情報ファイルから読み直してcatalogを作り直すAPIがある
- [ ] #2 realアダプタのテストで、catalogの値を壊して除外された作品が、読み直し後に作品一覧（GET /works）へ戻り、直近のスキャン結果（GET /scan/last。TASK-511.11で実行単位の項目を返す経路）の dataIntegrityWarning からも消えることを確認している
- [ ] #3 作品情報ファイルが無い・読めないなど読み直しで直らないときはエラーを返し、ほかの作品のcatalogに影響しない
- [ ] #4 fixtureアダプタで、データ不整合の作品を読み直すと GET /scan/last の dataIntegrityWarning から対象が消える
- [ ] #5 pnpm check・pnpm test が通る
<!-- AC:END -->
