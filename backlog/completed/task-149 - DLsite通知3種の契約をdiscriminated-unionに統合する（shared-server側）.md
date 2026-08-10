---
id: TASK-149
title: DLsite通知3種の契約をdiscriminated unionに統合する（shared/server側）
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 13:08'
updated_date: '2026-07-30 16:21'
labels: []
dependencies: []
priority: medium
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-132（クライアントの3モーダル・3フック共通化）のサーバー/契約側。ルートは既に GET /dlsite/notifications/:kind の単一エンドポイントだが、契約とアダプタが2系統に分裂している（2026-07-30調査、2エージェントで裏取り済み）。

事実:
- shared/src/api.ts:60-87 dlsiteNotificationItemSchema と、.extendで rjCode を足しただけの dlsiteParseFailedNotificationItemSchema、ページスキーマも2本
- server/src/routes/dlsite.ts:27-45 に if (kind === "parse-failed") の特別分岐
- server/src/adapters/real/workRepo.ts:877-945 の queryDlsiteNotifications / queryDlsiteParseFailedNotifications はSQL条件以外ほぼ同一。fixture/index.ts:381-412 も同型の重複
- DataAdapter のメソッドも2本（統合で34→33操作）

変更: kind: "rj-missing"|"fetch-failed"|"parse-failed" を持つ単一契約に統合し、アイテムは rjCode: z.string().nullable() を常に持つ形へ。real/fixtureのクエリ関数も条件だけkindでswitchする1本に畳む。合計60〜80行減の見込み。

リスク: parse-failed の rjCode 必須性が型上緩む（実データでは常に入るため実害小）。

着手順: 本タスク（契約・server）→ TASK-132（client）の順で行うと全層一貫する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 通知アイテム・ページのスキーマとDataAdapterメソッドが1系統に統合され、ルートのkind特別分岐が消えている
- [x] #2 3種の通知一覧・件数が現状と同じ内容を返す（real・fixture、テストあり）
- [x] #3 pnpm check・pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. sharedの通知スキーマをkind付き単一契約へ統合（rjCodeはnullable常設）
2. DataAdapterメソッド1本化、routeのparse-failed分岐削除
3. real/fixtureのクエリ関数を1本へ
4. client側fetch層の型追随（最小）
5. pnpm check + pnpm test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装。kind enum + rjCode nullable常設の単一スキーマへ統合し、DataAdapterメソッド・real/fixtureクエリ・routeの分岐を1本化。全体check + test:server 344件 + test:client 389件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite通知3種の契約をdiscriminated union相当（kind引数+単一スキーマ）に統合。TASK-132（client側の重複解消）の前提が整った。
<!-- SECTION:FINAL_SUMMARY:END -->
