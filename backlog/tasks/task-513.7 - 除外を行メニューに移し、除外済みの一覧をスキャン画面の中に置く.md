---
id: TASK-513.7
title: 除外を行メニューに移し、除外済みの一覧をスキャン画面の中に置く
status: Done
assignee: []
created_date: '2026-11-20 10:41'
updated_date: '2026-11-20 13:50'
labels:
  - scan
  - ui
dependencies:
  - TASK-513.6
references:
  - 'https://claude.ai/artifact/XvdN9UKvcg9GtL2gixXQ34'
documentation:
  - docs/adr/0039-scan-modal-current-problems-and-explicit-states.md
parent_task_id: TASK-513
priority: high
ordinal: 595000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0039「未登録タブは取得・追加・除外を分ける」のうち除外。今はツールバーの「除外」が全選択のまま押せて1クリックで全候補が除外され、戻す場所は元に戻すトーストか設定モーダルの節だけ（監査H2、確認済み）。除外のAPIは既存のものを使う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ツールバーに「除外」ボタンが無く、行の︙メニューと主ボタン▾の「選択を除外」から除外できる
- [x] #2 除外すると「元に戻す」付きのトーストが出る（1件なら作品名入り）。トーストの文言は「除外」で、「候補から外しました」は使わない
- [x] #3 ツールバーの「除外済み N」から除外した候補の一覧を開き、行ごとに戻せる。戻した候補は未登録の一覧に戻る
- [x] #4 設定モーダルの除外フォルダーの節が無くなっている（関連するテスト・smokeも整理されている）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
391b840f で feat/scan-redesign に着地。レビュー2周（実機計測含む）、check/test/smoke全体45件pass。ExcludedFoldersSettings.tsxは.trash-TASK-513.7へ退避（未追跡、要ユーザー削除）。
<!-- SECTION:NOTES:END -->
