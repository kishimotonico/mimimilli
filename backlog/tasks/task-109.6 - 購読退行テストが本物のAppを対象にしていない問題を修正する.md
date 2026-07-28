---
id: TASK-109.6
title: 購読退行テストが本物のAppを対象にしていない問題を修正する
status: To Do
assignee: []
created_date: '2026-07-28 13:03'
updated_date: '2026-07-28 13:03'
labels: []
dependencies: []
parent_task_id: TASK-109
priority: medium
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109.3 / 109.4 で追加した購読退行テスト（appNotificationSubscriptions.test.tsx / appPlayerSubscriptions.test.tsx）は、実際の App ではなく購読を持たないよう手書きした AppLikeRoot を描画している。そのため将来 App 本体に購読が再導入されてもテストは通ってしまい、防ぎたい退行を検出できない。

Codex のレビューで指摘された（appNotificationSubscriptions.test.tsx:92-93）。確認したところ appPlayerSubscriptions.test.tsx も同じ形で、同根の問題が2コミットに入っている。

「わざと旧実装に戻して失敗を見る」確認は手書きルートに対しては効くが、本物の App が購読を復活させた場合は素通りする。

方針:
- 本物の App を描画して購読の有無を検証する形にする。App は多数の Provider とクエリを必要とするため、モックの整備が必要になる見込み
- 本物の App の描画が現実的でない場合は、App の購読有無を直接検証できる別の方法を検討する（ただし import の有無を見るような壊れやすい静的チェックは避ける）
- どちらの場合も、わざと App に購読を戻して実際に失敗することを確認する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 購読退行テストが本物の App（またはそれと等価な購読実体）を対象にしている
- [ ] #2 App に購読を戻すと実際にテストが失敗することを確認済み
- [ ] #3 109.3 と 109.4 の両方のテストが対象になっている
<!-- AC:END -->
