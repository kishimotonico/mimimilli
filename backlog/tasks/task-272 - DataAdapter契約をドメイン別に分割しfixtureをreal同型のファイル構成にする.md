---
id: TASK-272
title: DataAdapter契約をドメイン別capability型に分割しshared契約の重複を統一する
status: Done
assignee: []
created_date: '2026-08-08 21:20'
updated_date: '2026-08-09 10:58'
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
- [x] #1 DataAdapter がドメイン別インターフェースに分割され、createApp が合成で受け取ること
- [x] #2 scanProgressEventSchema が実際にemitされる形だけを表現していること
- [x] #3 tags/tagOp フィルタ型が shared の1定義に統一されていること
- [x] #4 serverテストが通ること
- [x] #5 fixtureが共有stateに自然なモジュール境界で分割され、903行の単一ファイルが解消されていること（realとの物理同型は要件としない）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
adapter.ts を adapter/ 配下の6capability型（計205行）へ分割し、DataAdapter はその交差型として合成。createApp は平坦な合成を受ける形を維持。エラー型（WorkRegisterError・DlsiteOfflineError・NotConfiguredError・InvalidResumeError）は server/src/errors.ts へ集約し、TASK-259で確立したレイヤ境界（routes/・fixture/ から real/ へのimport禁止）は維持されている。tags/tagOp 型は shared の AxisFacetsQuery・SmartFolderEvalQuery へ統一。scanProgressEventSchema の縮小は安全性を検証済み: このスキーマは parse/safeParse されず z.infer の型生成にのみ使われ、clientがSSEでランタイム検証するのは別スキーマの scanJobEventSchema（無変更、completed/failed/cancelled を保持）。Worker の完了・失敗は ScanWorkerMessage という別プロトコル。fixture は state.ts(63行)を中心に9モジュールへ分割し、各 createXMethods(state) がクロージャで state を直接参照する形でgetter/setterの儀式は無い。検証: pnpm check 成功、server 531 pass / 0 fail、client 781 tests 全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DataAdapter をドメイン別 capability型へ分割し交差型で合成、createApp は平坦な合成を維持した。エラー型を errors.ts へ集約し、tags/tagOp 型を shared へ統一。scanProgressEventSchema を実emit形へ縮小（ランタイム影響なしを検証）。903行の fixture/index.ts を共有state中心の9モジュールへ分割。pnpm check と server 531 / client 781 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
