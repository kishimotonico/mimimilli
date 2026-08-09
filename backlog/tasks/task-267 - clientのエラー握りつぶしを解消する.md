---
id: TASK-267
title: clientのエラー握りつぶしを解消する
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
labels: []
dependencies: []
priority: medium
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査で検出。AGENTS.md「エラーは隠蔽しない」と矛盾する .catch(() => {}) が散在。
- features/player/model/useResumePersistence.ts:25 と useAudioEngineLifecycle.ts:210,227 の resume/last-played 保存失敗の無視
- features/scan/ui/ScanModal.tsx:247,254,260 の start/cancel 失敗の無視
- app/ui/TopBar.tsx:162 の DLsite一括キャンセル失敗の無視
- shared/api/http.ts:37-38 readResponseBody が res.json() 失敗を null に潰し、非JSONエラー応答の原因が消える
resume/last-played のようにサイレントが適切な箇所は「意図的にサイレント」とわかる形（debugログ+方針コメント or ADR明文化）にし、ユーザー操作起点の失敗（scan start/cancel、bulkキャンセル）はトースト等でUIに出す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ユーザー操作起点の失敗（scan start/cancel・bulkキャンセル）がUIに表示されること
- [ ] #2 resume/last-played 保存失敗の扱いが意図の明文化付きで整理されていること
- [ ] #3 readResponseBody がパース失敗時に原因情報を失わないこと
- [ ] #4 clientのcheck・変更範囲のテストが通ること
<!-- AC:END -->
