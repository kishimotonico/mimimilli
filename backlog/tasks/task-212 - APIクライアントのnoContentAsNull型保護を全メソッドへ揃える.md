---
id: TASK-212
title: APIクライアントのnoContentAsNull型保護を全メソッドへ揃える
status: To Do
assignee: []
created_date: '2026-08-06 04:59'
updated_date: '2026-08-09 15:07'
labels: []
dependencies: []
priority: medium
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/shared/api/http.ts の getParsed（L99-118）は2つのオーバーロードで noContentAsNull: true のときだけ戻り値型に | null を付けて型契約を守っているが、同じ ParsedRequestOptions を受け取れる postParsed（L121-135）・putParsed・patchParsed・deleteParsed（L175-186）は戻り値が無条件で Promise<T> のまま、内部で parsed as T している。

そのため postParsed(schema, path, body, { noContentAsNull: true }) と書いても TypeScript は検知できず、204 レスポンス時に null が T として静かに返る。

現状 noContentAsNull: true を渡しているのは getParsed 経由の3箇所（features/scan/api.ts:59,72、entities/work/api.ts:117）のみで実害は出ていないが、それは呼び出し側がたまたま踏んでいないだけ。同じ問題に対して片方だけ根本対処し、他方は未対応で放置されている状態であり、AGENTS.md が名指しする「型で表明できる不変条件を型で守れていない」箇所にあたる。

直し方は getParsed と同じ2オーバーロードのパターンを4関数へ適用するだけ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 postParsed / putParsed / patchParsed / deleteParsed が getParsed と同じオーバーロードで noContentAsNull の有無を戻り値型に反映している
- [x] #2 noContentAsNull: true を渡した場合に戻り値が null を含む型になり、そうでない場合は含まないことが型レベルで確認できる
- [x] #3 parsed as T による型の握りつぶしが残っていない
- [x] #4 pnpm check と pnpm test が通る
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-267（エラー処理契約の一本化）からの統合: client/tests/unit/http.test.ts が非JSON応答とJSON契約エラー応答の2件しかカバーしていない。readResponseBody を res.text() ベースへ変えた直後なので、エラーパスの契約（非JSON応答、ステータス別の型、空本文、パース失敗時の本文保持）に限定したテストを本タスクで併せて整備する。網羅的なカバレッジ拡充は目的にしない（AGENTS.md「テストは網羅性より実行速度」）。
<!-- SECTION:NOTES:END -->
