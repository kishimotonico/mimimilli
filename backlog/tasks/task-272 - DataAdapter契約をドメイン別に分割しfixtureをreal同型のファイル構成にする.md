---
id: TASK-272
title: DataAdapter契約をドメイン別capability型に分割しshared契約の重複を統一する
status: To Do
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 00:29'
labels: []
dependencies: []
priority: medium
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。server/src/adapter.ts の DataAdapter が約30メソッドを単一インターフェースに集約している。
- DataAdapter をドメイン別のcapability型（WorkAdapter / ClassificationAdapter / MediaAdapter / DlsiteAdapter / FsAdapter / SettingsAdapter 等）へ分割し、createApp は平坦な合成adapterを受ける形を維持する
- adapter.ts:56-69 / core/axisFacets.ts:15-18 / shared/api.ts:91-95 で同型の tags・tagOp フィルタ型が別名で重複 → sharedのクエリ型を正として統一する
- shared/src/scan.ts:30-45 scanProgressEventSchema の complete/error 変種は adapter経路で未使用（進捗はprogressのみemit、完了はScanJobManagerが別経路）→ スキーマを実態に合わせて縮小する
- fixture/index.ts:340-374 の resolveFsNode / resolveFsPath のほぼ同一パス走査を1関数に統合する
Codexレビュー反映: fixture の「realと同型のファイル構成」は要件にしない。fixture は共有可変stateを持つため、realの物理構成を模倣するとstate受渡しの儀式だけが増える。fixtureの分割は共有stateに自然なモジュール境界で行い、粒度は実装担当の裁量とする（903行の単一ファイル解消自体は維持）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 DataAdapter がドメイン別インターフェースに分割され、createApp が合成で受け取ること
- [ ] #2 scanProgressEventSchema が実際にemitされる形だけを表現していること
- [ ] #3 tags/tagOp フィルタ型が shared の1定義に統一されていること
- [ ] #4 serverテストが通ること
- [ ] #5 fixtureが共有stateに自然なモジュール境界で分割され、903行の単一ファイルが解消されていること（realとの物理同型は要件としない）
<!-- AC:END -->
