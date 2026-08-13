---
id: TASK-318
title: scanの自動登録を廃止し未登録候補の提示・選択登録へ置き換える
status: Done
assignee:
  - '@codex'
created_date: '2026-08-12 12:18'
updated_date: '2026-08-12 13:48'
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
- [x] #1 scanがsidecarを自動生成・自動登録しない
- [x] #2 未登録候補（フォルダーパス・推定タイトル・音声内訳）がscan結果として記録されAPIで取得できる
- [x] #3 入れ子作品の分割・ルート直下音声の親昇格の誤登録パターンが候補判定で解消されている（テストで再現）
- [x] #4 既存の登録済み作品は再判定されず変更されない
- [x] #5 除外マークがuser DBへ永続化され、除外済みフォルダーは候補に再登場しない
- [x] #6 登録実行APIが選択候補のみ登録し、登録作品をDLsite取得へenqueueする
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scan結果と候補APIの契約を追加する。2. 永続adapterで候補判定、除外保存、選択登録を実装する。3. API・fixture・テストを更新し、受け入れ条件を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
scanの自動生成を候補収集へ置換し、候補の再検証付き一括登録・user DB除外・DLsite enqueueを追加。既存の自動生成前提テストを候補提示と明示登録の回帰テストへ更新。typecheck・lint・format・テストは検証担当へ委ねる。

統括レビューを受け、検証と既存回帰テスト更新を継続する。

検証完了: shared/server typecheck、scanner(32件)、候補実装(2件)、候補API(1件)、候補heuristic(3件)、scan progress(16件)、DLsite(47件)、DB backup/migration(16件)を直接実行して通過。担当ファイルのformat checkとgit diff --checkも通過。全体lintは既存の client/src/features/files/ui/FilePreview.tsx:381 のmedia-has-caption警告で失敗（本タスク外）。

統括レビューにより、一括登録をstale事前検証と個別成否返却へ修正する。

レビュー修正: registerは最新walkで全選択候補を先に検証し、staleなら書込み前に409。登録中の個別I/O・投影失敗はfailuresへ収集して継続し、registered成功直後にDLsite enqueue callbackを実行する。全成功・部分成功・全失敗・stale APIテスト、stale時のsidecar非生成テストを追加。typecheck、scanner、DLsite、DB migration、candidate/APIテスト、担当ファイルformat、diff checkを再通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scan候補の一括登録は、最新walkによる全件stale検証後に実行する。成功はpath/workId、失敗はpath/messageを返し、部分失敗でも成功済みを隠さない。成功ごとにDLsite取得をenqueueする。候補・登録結果API、実装、既存scan/DLsite回帰、migration検証を更新し、関連テストとtypecheckを通過。
<!-- SECTION:FINAL_SUMMARY:END -->
