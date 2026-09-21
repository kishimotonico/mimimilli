---
id: TASK-455
title: 正本確定・catalog反映・応答生成を区別する結果契約を作る
status: To Do
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-21 13:45'
labels: []
dependencies:
  - TASK-452
  - TASK-454
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 509000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「結果」契約。現在は単作品投影の catalog 公開後に live probe を含む Work 取得が続くため、その後段の例外まで投影失敗に分類すると、保存済みの変更を失敗として表示してしまう。source の確定、catalog への反映、その後の応答生成と再取得を区別する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 保存結果が確定した編集snapshotから組み立てられ、Work の再取得成功が保存成功の条件になっていない
- [ ] #2 catalog公開後の応答構築で起きた失敗が投影失敗として表示されない
- [ ] #3 通信断が結果不明として扱われ、成功も失敗も推測されない
- [ ] #4 永続ジョブ台帳や補償処理を追加していない
- [ ] #5 source 確定済みで catalog へ未反映と分かる場合、その事実と確定済み snapshot が示される
- [ ] #6 反映の再試行が現在の正本を読み、旧編集・旧snapshot・DLsiteのHTTP取得を再実行しない
- [ ] #7 未反映の回復を既存scanで行うか対象限定操作で行うかが選定され、全scanを使う場合は他作品へ及ぶ影響が説明されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
「再試行で再送しない」の対象は反映の再試行であり、確定した保存エラーをユーザーが修正して再保存する操作までは禁止しない。通信断の結果不明は別扱いのまま残す。
<!-- SECTION:NOTES:END -->
