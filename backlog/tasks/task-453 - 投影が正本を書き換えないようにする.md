---
id: TASK-453
title: 投影が正本を書き換えないようにする
status: To Do
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-21 13:44'
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
- [ ] #5 一作品の投影値と由来revisionが、同じ入力snapshotに対応している
- [ ] #6 公開前に入力の変更を検知した場合、古い投影を最新として公開せず、未反映・再確認が必要な状態として扱う
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
入力変更の検知は、外部書込みを永久にロックする要求ではない。確認後の将来変更まで防ぐ保証や無限再試行は求めない。
<!-- SECTION:NOTES:END -->
