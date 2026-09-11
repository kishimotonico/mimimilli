---
id: TASK-447.8
title: スマートフォルダー表示中の絞り込み候補集計を2万件規模で計測する
status: Done
assignee: []
created_date: '2026-09-11 00:53'
updated_date: '2026-09-11 01:04'
labels:
  - ux
  - perf
  - triage
dependencies: []
parent_task_id: TASK-447
priority: medium
ordinal: 476000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 AC#5。残す判定の 432 は、スマートフォルダー表示中に軸を切り替えるたび、フォルダー条件の評価と軸集計を JS で2段の全件走査する（tmp/uiux-triage-2026-09-11/design-review.md (B)-3）。実データは使わず、計測用 worktree だけで server/src/adapters/fixture/scenarios.ts の LARGE_SCENARIO_WORK_COUNT を 20000 に上げて計測する（変更はコミットしない）。fixture 側は adapters/fixture/classification.ts で core の evalSmartFolderRules を使うので、real adapter の SQL 部分とは経路が違う点を結果に明記する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 計測用 worktree で LARGE_SCENARIO_WORK_COUNT を 1000 と 20000 にした2条件で、スマートフォルダー表示中の軸切替時の facets API 応答時間とクライアントの longtask を計測している
- [x] #2 比較として、スマートフォルダー外（すべての作品）で同じ軸切替を計測している
- [x] #3 fixture と real adapter の処理経路の違い（どこまでが同じコードか）を結果に明記している
- [x] #4 計測手順と結果の表をタスクメモに記録し、LARGE_SCENARIO_WORK_COUNT の変更はコミットされていない
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 計測手順

- worktree: `.worktrees/447.8`（branch `task/447.8`）で `server/src/adapters/fixture/scenarios.ts` の `LARGE_SCENARIO_WORK_COUNT` を 1000→20000 に一時変更（計測後 1000 に戻し、`git diff` が空であることを確認済み）
- `server/src/adapters/fixture/classification.ts` の `getAxisFacets` に一時計装（`evalSmartFolderRules` と `buildAxisFacets` を分けて `performance.now()` で計測、console.log 出力）を追加。計測後に削除済み
- 本番ビルドで計測: `pnpm run preview:fixture:large`（`vite build` → `portless run --name mimi bun server/src/index.ts`、URL `http://447-8.mimi.localhost:1355`）
- ブラウザは agent-browser `--session measure-447-8` で操作
- 対象: スマートフォルダー「長時間 ASMR」（長さ≥3600秒 AND タグ`カテゴリ/ASMR`,`環境音`）。1000件中114件、20000件中2267件が一致
- facets API 応答時間: フォルダー内絞り込みパネル（「絞り込み」→軸選択、`GET /api/axes/:axis?smartFolder=sf-1` を呼ぶ経路）と同一のエンドポイントに対し、ブラウザの `fetch()` を直接叩いて `performance.now()` で計測（軸あたり5回、中央値）。UI操作（ボタンクリックでの軸切替）でも同じネットワークリクエストが発生することを確認済み（応答時間はUI経由でもfetch直呼びでも同一エンドポイント・同一処理のため差はない）
- longtask: `PerformanceObserver({entryTypes:['longtask']})` をUI操作前に仕込み、実際のボタンクリック（フォルダー内で「絞り込み」→CV/タグ軸を選択）で計測
- サーバー側内訳（`evalSmartFolderRules` と `buildAxisFacets` の内訳）は一時計装のconsole.logから収集

## 結果: facets API 応答時間（ms、fetch直呼び5回の中央値）

| 軸 | 1000件・フォルダー内 | 1000件・全作品 | 20000件・フォルダー内 | 20000件・全作品 |
|---|---|---|---|---|
| CV | 6 | 8 | 31 | 68 |
| サークル | 7 | 8 | 32 | 63 |
| シリーズ | 6 | 8 | 30 | 38 |
| カテゴリ | 6 | 7 | 33 | 67 |
| タグ | 8 | 14 | 42 | 226 |
| 追加日(year) | 6 | 7 | 30 | 46 |

## 結果: サーバー処理内訳（一時計装、ms）

フォルダー内（`evalSmartFolderRules` → `buildAxisFacets` の2段）:

| 軸 | 1000件: eval / build / total | 20000件: eval / build / total |
|---|---|---|
| CV | 0.9 / 0.3 / 1.2 (目安) | 18-29 / 6-10 / 24-39 |
| サークル | 同程度 | 18-20 / 5-6 / 24-25 |
| シリーズ | 同程度 | 19-21 / 4 / 23-25 |
| カテゴリ | 同程度 | 19-20 / 7 / 26-27 |
| タグ | 0.9 / 0.85 / 1.7-1.8 | 19-29 / 15-37 / 34-66 |
| 追加日 | 0.8-0.9 / 0.1 / 0.9-1.1 | 19-25 / 4-5 / 22-29 |

全作品（`buildAxisFacets` のみ、フォルダー条件なし）:

| 軸 | 1000件 build | 20000件 build |
|---|---|---|
| CV | 3-6 | 60-82 |
| サークル | 3-5 | 54-59 |
| シリーズ | 1-2 | 31-32 |
| カテゴリ | 2-3 | 59-64 |
| タグ | 5-9 | 215-271（最も重い） |
| 追加日 | 1.3-1.4 | 39-50 |

## 結果: longtask

- 1000件・20000件どちらも、フォルダー内の軸切替（実UI操作、CV軸・タグ軸で確認）で longtask（50ms超のメインスレッド専有）は検出されなかった（`window.__longtasks` は常に空配列）
- サーバー処理が最も重いタグ軸・フォルダー内（20000件で34-66ms）でも、クライアント側のレンダリングは50msの壁を超えていない

## fixture と real adapter の経路の違い

- 共通コード: `evalSmartFolderRules`（`server/src/core/smartFolder.ts`）と `buildAxisFacets`（`server/src/core/axisFacets.ts`）は fixture・real 両方が使う純粋関数で、実装は完全に同一
- fixture（`server/src/adapters/fixture/classification.ts` の `getAxisFacets`）: フォルダー条件のある場合、`evalSmartFolderRules(folder.rules, state.works)` を**保持している全作品**に対して実行し、その結果を `buildAxisFacets` にかける。SQLによる絞り込みは無い（インメモリ配列の全件走査のみ）
- real（`server/src/adapters/real/smartFolderWorks.ts` の `getSmartFolderAxisFacets`）: まず `query.resolveSmartFolderCandidateIds(folder.rules)` でSQLによる候補ID抽出を行い、`query.listSummaries(candidateIds)` で**候補分だけ**サマリーを取得してから、同じ `evalSmartFolderRules` → `buildAxisFacets` の2段JS処理にかける。JS走査の対象はSQLで絞り込んだ候補集合であり、全件ではない
- つまり両者ともフォルダー内では「JSで2段走査」という構造は共通だが、fixtureは常に全件（DB全体相当）を対象にJS走査するのに対し、realはSQLで絞り込んだ候補集合だけをJS走査する。今回の実測値（fixture・20000件・全作品）はrealでの「SQL絞り込みが効かない・全件がヒットする」最悪ケースに近い上限の目安として読むべきで、通常のrealの応答時間はこれより速くなる可能性が高い

## 所感

- 20000件規模でも、絞り込み条件のあるスマートフォルダー内（2267件に絞られた状態）での軸切替は fetch直測定で30-42ms程度（タグ軸のみ42ms）に収まり、サーバー処理内訳も eval 20-30ms + build 4-37ms 程度。UI上のlongtaskも検出されず、体感で問題になる水準ではなさそう
- 一方「全作品」表示（フォルダーによる絞り込みなし）でタグ軸を集計する場合は20000件でserver側buildだけで215-271ms、fetch往復で226msとなり、他の軸（30-80ms台）より頭一つ重い。これはタグ軸が「作品ごとに複数タグを持つ」構造のため、他軸よりmembersByValueへの追加回数が多いことが主因と見られる
- TASK-432で指摘された「2段JS全件走査」自体は事実だが、今回計測した範囲（絞り込みで数千件程度に絞られるフォルダー）では20000件規模でも実用上の遅延は小さい。懸念が顕在化するとすれば「フォルダー条件がほぼ絞り込まない（ヒット件数が全体の大部分を占める）」ケースで、その場合は実質「全作品」表示に近い所要時間（タグ軸で200ms超）になりうる。件数がさらに数万件単位で伸びる、またはタグ数が多い作品が増える場合は再計測を推奨
<!-- SECTION:NOTES:END -->
