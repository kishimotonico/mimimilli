---
id: TASK-178
title: 軸値ファセットの契約を件数のみから総時間・代表カバーを含む形へ拡張する
status: Done
assignee:
  - impl-178
created_date: '2026-08-03 14:44'
updated_date: '2026-08-04 12:15'
labels: []
dependencies: []
priority: high
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ再設計（ADR-0012 / DRAFT-50）の値一覧は、grid で代表カバー2×2コラージュ＋名前＋件数、list で コラージュ/名前/件数/総時間 の列を出す。現行の AxisFacetItem は { value, count } のみで総時間・カバーが取れないため、共有契約とサーバー実装（real / fixture / core）を拡張する。クライアント側の表示は後続タスクの担当で、本タスクは契約とデータ供給までを担う。

対象: shared/src/library.ts の axisFacetItemSchema / server/src/core/axisFacets.ts / server/src/adapters/real/workRepo.ts の getAxisFacets / server/src/adapters/fixture/index.ts

代表カバーは値ごとに最大4件、作品の追加日時の新しい順で選ぶ。cover が無い作品はスキップし、4件に満たない場合はある分だけ返す（プレースホルダーはクライアント側の責務）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AxisFacetItem が value / count / durationSec / covers（最大4件、各要素は WorkListItem.cover と同じ形）を持つ
- [x] #2 GET /axes/:axis が year・tag・prefix いずれの軸でも拡張後の形で応答する
- [x] #3 real アダプタと fixture アダプタが同一の契約で応答し、両者を通す既存の契約テストが更新されて通る
- [x] #4 代表カバーは追加日時の新しい順に最大4件で、cover 未設定の作品は含まれない
- [x] #5 durationSec がその値に属する全作品の再生時間合計と一致することをテストで検証している
- [x] #6 値が1000件規模の軸で GET /axes/:axis の応答時間を実測し、拡張前後の差をタスクの実装ノートに記録している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装: AxisFacetItem に durationSec（totalDurationSec未知の作品は合算から除く=NULLをSUMが無視するのと同義）とcovers（最大4件、addedAt新しい順、cover未設定はスキップ）を追加。
shared: coverSchemaの実体をwork.tsからcover.tsへ移設（library.tsがcoverValueSchemaを参照するとwork.ts<->library.tsの既存循環importに巻き込まれるため）。
server/core: buildAxisFacetsをvalueごとの件数カウントからWorkSummary[]保持に変更し、durationSecはtotalDurationSec合算、coversはaddedAt降順ソート後フィルタ・スライスで算出。
server/real: getAxisFacets を base CTE（1作品1行、value/addedAt/duration/cover/tie-break用sort_keyを保持）+ ROW_NUMBER()で値ごとcover候補を新しい順に採番 + json_group_arrayで4件までJSON配列化、の単一クエリに統合。year/tag/prefixはbase CTEのSELECT本体のみ差し替え。N+1にはしていない。
fixture: buildAxisFacetsをそのまま使う既存構造のため変更不要。

実測（1000件規模）: 単体プロセス内でVALUE_COUNT=1000（distinctなcv値）×5件/値=works 5000件、covers付与3分の2、を投入しrepo.getAxisFacets("cv")を10回計測。
- 拡張前相当のcountのみクエリ: 約4.0〜4.9ms
- 拡張後（durationSec+covers込み）: 約17〜24ms（ウォームで17〜20ms台）
値の絶対数が1000規模でも170ms等には達せず、体感遅延にはならない水準。ベンチスクリプトはリポジトリに残していない（一時ファイルとして削除済み）。

契約テスト: server/tests/real/worksQueryContract.test.ts の「core参照実装とreal SQLのファセット値・件数・順序が同値」で real/core 一致をvalue/count/durationSec/covers込みで検証。tagPrefixes.test.tsにdurationSec合算（null除外）とcovers（新しい順4件・cover未設定除外）の単体テストを追加。

client側は型追従のみ必要な箇所は無かった（AxisFacetItemを直接分解している箇所が既存では未使用のため、pnpm --filter clientのtypecheckは無変更で通過）。
<!-- SECTION:NOTES:END -->
