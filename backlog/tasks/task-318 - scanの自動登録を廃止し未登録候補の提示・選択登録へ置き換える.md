---
id: TASK-318
title: scanの自動登録を廃止し未登録候補の提示・選択登録へ置き換える
status: To Do
assignee: []
created_date: '2026-08-12 12:18'
labels: []
dependencies:
  - TASK-310
  - TASK-314
priority: high
ordinal: 328000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-166の要件確定（2026-08-12決定: 候補提示＋一括承認へ全面置換）を受けた実装。scanはメタ無し音声フォルダーへsidecarを自動生成・自動登録せず、未登録候補としてscan結果に記録する。候補判定はfindWorkRoot昇格ヒューリスティックを改善し、既知の誤登録パターン（入れ子作品が複数に分割される／ルート直下音声で親フォルダーが作品化する。TASK-166参照）を候補段階で正しく扱う。既存の登録済み作品（sidecarあり）は新ルールで再判定しない（2026-08-12決定）。除外マークはuser DBへ保存し、除外済み候補は以後提示しない。登録実行APIは選択された候補のみsidecar生成→catalog投影し、登録された作品をDLsite取得ジョブへenqueueする（取得は自動・適用は明示承認、TASK-320参照）。確認UIはTASK-319。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scanがsidecarを自動生成・自動登録しない
- [ ] #2 未登録候補（フォルダーパス・推定タイトル・音声内訳）がscan結果として記録されAPIで取得できる
- [ ] #3 入れ子作品の分割・ルート直下音声の親昇格の誤登録パターンが候補判定で解消されている（テストで再現）
- [ ] #4 既存の登録済み作品は再判定されず変更されない
- [ ] #5 除外マークがuser DBへ永続化され、除外済みフォルダーは候補に再登場しない
- [ ] #6 登録実行APIが選択候補のみ登録し、登録作品をDLsite取得へenqueueする
<!-- AC:END -->
