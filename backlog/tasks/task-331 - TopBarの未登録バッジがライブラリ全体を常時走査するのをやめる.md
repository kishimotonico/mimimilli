---
id: TASK-331
title: TopBarの未登録バッジがライブラリ全体を常時走査するのをやめる
status: To Do
assignee: []
created_date: '2026-08-14 08:20'
labels: []
dependencies: []
priority: high
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー2026-08-14（マージe9c16fbの事後レビュー）の指摘。TopBar.tsx:49のuseQueryがGET /scan/candidatesを呼び、real adapterのlistCandidates（scanner.ts:369）は毎回walkPhaseでライブラリ全体を再帰走査する。react-queryのデフォルト設定のため、アプリ起動時とウィンドウフォーカス再取得のたびにスキャンジョブ外でフルI/Oが発生し、大規模・ネットワーク配置のライブラリで高負荷になる。バッジ件数は明示的なスキャン・候補操作の結果から導出し、暗黙のフル走査を排除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TopBarのバッジ表示がライブラリ全体のファイルシステム走査を伴わない（前回スキャン結果・保存済み件数などから導出する）
- [ ] #2 スキャン完了・候補の登録・除外・除外解除の後にバッジ件数が追従する
- [ ] #3 ウィンドウフォーカスの出入りでlistCandidatesのフル走査が発生しないことを確認できるテストまたは計測がある
- [ ] #4 pnpm test:smokeが通る
<!-- AC:END -->
