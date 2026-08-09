---
id: TASK-272
title: DataAdapter契約をドメイン別に分割しfixtureをreal同型のファイル構成にする
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
labels: []
dependencies: []
priority: medium
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapter.ts の DataAdapter が設定・作品・分類・FS・メディア・DLsiteの約30メソッドを単一インターフェースに集約しており、real側は *Methods.ts に分割済みなのに契約とfixture（adapters/fixture/index.ts 903行の単一ファイル）が単一のまま非対称。
- DataAdapter をドメイン別インターフェース（WorkAdapter / ClassificationAdapter / MediaAdapter / DlsiteAdapter / FsAdapter / SettingsAdapter 等、realのMethods分割と対応する粒度）へ分割し、createApp で合成する
- fixture を real と同型のファイル構成（works / classification / media / dlsite / fs / settings）に分割する
- fixture/index.ts:340-374 の resolveFsNode / resolveFsPath のほぼ同一パス走査も1関数に統合する
- shared/src/scan.ts:30-45 scanProgressEventSchema の complete/error 変種は adapter経路で未使用（進捗はprogressのみemit、完了はScanJobManagerが別経路）→ スキーマを実態に合わせて縮小する
- adapter.ts:56-69 / core/axisFacets.ts:15-18 / shared/api.ts:91-95 で同型の tags・tagOp フィルタ型が別名で重複 → sharedのクエリ型を正として統一する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DataAdapter がドメイン別インターフェースに分割され、createApp が合成で受け取ること
- [ ] #2 fixture が real と同型のファイル構成に分割されていること
- [ ] #3 scanProgressEventSchema が実際にemitされる形だけを表現していること
- [ ] #4 tags/tagOp フィルタ型が shared の1定義に統一されていること
- [ ] #5 serverテストが通ること
<!-- AC:END -->
