---
id: TASK-149
title: DLsite通知3種の契約をdiscriminated unionに統合する（shared/server側）
status: To Do
assignee: []
created_date: '2026-07-30 13:08'
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
- [ ] #1 通知アイテム・ページのスキーマとDataAdapterメソッドが1系統に統合され、ルートのkind特別分岐が消えている
- [ ] #2 3種の通知一覧・件数が現状と同じ内容を返す（real・fixture、テストあり）
- [ ] #3 pnpm check・pnpm test が通る
<!-- AC:END -->
