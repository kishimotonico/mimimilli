---
id: TASK-474
title: server/sharedの重複実装と例外メッセージ取得を共通化する
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
updated_date: '2026-10-02 11:50'
labels:
  - server
  - shared
  - refactor
dependencies: []
priority: medium
ordinal: 532000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で見つかったserver/sharedの重複: (1) 音声拡張子セットがshared/src/meta.ts:44・server/src/adapters/real/scanAudio.ts:10・paths.ts:189に3重定義、拡張子取得もfileExtensionOf/extOf/isAudioPathの3実装 (2) JSONパース失敗→MetaParseError化がserver/src/adapters/real/meta.ts（94,113,275付近）とscanRegister.tsで4重複 (3) scanRegister.ts:192-231で同じcontentを同一IIFEで2回パースしている (4) (e as Error).message が約16箇所（meta.ts, scanWalk.ts, scanAudio.ts, probe.ts, dlsiteFetch.ts, dlsiteCacheCli.ts等）で非Errorのthrow時にundefinedになる (5) routeの await c.req.json().catch(() => null) が約19箇所あり、lib/jsonBody.tsと別系統で不正JSONと不正スキーマの区別が消えている。SSE直列化の重複はTASK-448.3で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 音声拡張子の定義と拡張子取得がsharedの1箇所に集約されている
- [ ] #2 例外からのメッセージ取得がunknownを受けるヘルパー経由になり、(e as Error).message が残っていない
- [ ] #3 routeのリクエストボディ読み取りが1系統に統一され、不正JSONと不正スキーマが区別されて応答される
- [ ] #4 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: メタJSONのパース失敗の集約とscanRegisterの二重パース（旧AC#2）は、メタファイル読み込みの入口を一本化するTASK-482で扱うためこのタスクから外した。音声拡張子の三重定義（AC#1）は点検でも確認済み（doc-6 shared-8）。
<!-- SECTION:NOTES:END -->
