---
id: TASK-453
title: 投影が正本を書き換えないようにする
status: To Do
assignee: []
created_date: '2026-09-21 10:48'
labels: []
dependencies: []
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 507000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「投影」契約。syncDetectedRjCode が scan と単作品投影の途中で mimimilli.json へ RJ コードを書き戻している。単作品登録・投影・復元は full:true を指定するため必ずこの経路を通る。正本を観測する処理が正本を書き換える構造をなくす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scan と再投影の経路が mimimilli.json を書き換えない
- [ ] #2 RJコード候補の検出そのものは残っている
- [ ] #3 登録時に自動採用する場合、登録コマンドが一度の正本確定に含め、その確定済み snapshot を投影へ渡す
- [ ] #4 既存作品の通常scanでは候補の提示までに留まり、適用は正本変更として扱われる
- [ ] #5 投影の途中で正本を書いてから読み直す経路が存在しない
<!-- AC:END -->
