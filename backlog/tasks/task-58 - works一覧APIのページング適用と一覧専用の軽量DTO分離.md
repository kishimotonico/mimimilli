---
id: TASK-58
title: works一覧APIのページング適用と一覧専用の軽量DTO分離
status: To Do
assignee: []
created_date: '2026-07-19 02:01'
updated_date: '2026-07-19 04:07'
labels: []
dependencies: []
priority: high
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
クライアントの buildWorksParams()（client/src/features/library/model/libraryPresentation.ts:23）が page/limit を送らず、サーバー側 paginate（server/src/core/worksQuery.ts:135）は両方指定時のみsliceするため、通常一覧は常に全件転送になっている。加えて WorkSummary に physicalPath/urls/dlsite状態全体/全タグが含まれ、30,000件で21〜45MB規模。総件数取得（useLibraryQueries.ts:61 の searchWorks({limit:1})）は page 未指定のため実際は全件返している。スマートフォルダーAPI（routes/smartFolders.ts:42）にはページング契約自体がない。

方針: サーバーにデフォルトlimit（未指定でも上限適用）を導入し、一覧専用の軽量DTO（id/title/coverImage/status/totalDurationSec/trackCount/bookmarked/lastPlayedAt/circleName等）を shared に定義。詳細は GET /works/:id で取得。総件数は専用のCOUNT APIか正しいページング指定に。スマートフォルダーにも同じページングエンベロープを適用。将来SQL化するなら深いoffsetを避けるためkeysetページングも視野（本タスクではoffsetで可）。

2026-07-19のパフォーマンス調査で高優先度と判定。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /works が limit 未指定でも全件返さない（サーバー側デフォルト上限がある）
- [ ] #2 一覧レスポンスが軽量DTOになり、physicalPath・urls・dlsite詳細・プレイリスト詳細を含まない
- [ ] #3 クライアントの一覧・総件数・スマートフォルダー表示がページング契約で動作する
- [ ] #4 fixture/real 両アダプタで契約が一致し、pnpm check と pnpm test が通る
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude-main
created: 2026-07-19 04:07
---
調整依頼(優先順位レビュー2026-07-19, doc-1参照): shared/API/clientのページング契約は継続でOK。real側のSQL実装はTASK-71のADR(検索所有権の決定)後に。bookmark/lastPlayedの取得実装はDB構成決定と連動。
---
<!-- COMMENTS:END -->
