---
id: TASK-95
title: スキャンのerror状態が固着する問題を解消し強制フルスキャン手段を用意する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-25 11:01'
updated_date: '2026-07-31 00:14'
labels: []
dependencies: []
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品のスキャンエラーが、原因が解消された後も消えないまま固着する。TASK-92の作業中に実際に踏んだ: 不具合のあるコードでスキャンした結果5作品がerror状態になり、コードを修正して再スキャンしてもerror状態とerrorMessageが古いまま残った。原因は増分スキャン(TASK-75)のスキップ判定が .meta.json の fingerprint 一致だけで決まること(server/src/adapters/real/scanner.ts の cachedFingerprint === fingerprint による continue)。しかしスキャンエラーの原因はメタだけでなくファイル側の状態にも依存する(参照先ファイルの欠損、トラックのstartがファイル全体長以上、probe失敗など)。そのためメタを touch しない限り、ファイルを直しても・コードのバグを直しても、作品はerrorのままになる。さらにUIにもAPI(POST /api/scan)にも強制フルスキャンの手段がないため、ユーザーはDBを手動削除する以外に復旧できない。増分スキャンの速度を維持したまま、ファイル起因のエラーが再評価される道筋を用意する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ファイル側の状態に起因するスキャンエラー（ファイル欠損・トラック区間の不正・probe失敗）が、原因を解消した後の再スキャンで解消される
- [x] #2 error状態の作品は、.meta.jsonのfingerprintが変わっていなくても再評価される
- [x] #3 UIから強制フルスキャンを実行でき、全作品がfingerprintに関係なく再処理される
- [x] #4 増分スキャンの速度上の利点が維持されている（正常な作品を毎回フル再処理しない）
- [x] #5 上記が自動テストで検証されている（error作品が原因解消後の再スキャンでokに戻る、強制フルスキャンで全件再処理される）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. error状態の作品はfingerprint一致でもスキップしない再評価ロジック
2. 強制フルスキャン（API+UI）の追加
3. error→ok回復・全件再処理のテスト
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codexレビュー3件対応: file-backed worker経路へのfull伝播（P1、本番専用経路の抜け）、error/full時のprobe cacheバイパス（誤duration再利用の固着防止）、POST /scanのbody検証（省略のみ許可・不正payload 400）。ビジュアルスナップショット更新（フルスキャンボタン追加）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
増分スキップ条件をcanSkipIncremental()へ集約しerror作品を毎回再評価、POST /api/scan {full:true}で強制フルスキャン（shared契約→worker→UI）。error回復・worker経由full・body検証のテスト追加。server 380/client 416テスト・ビジュアル6/6・pnpm check通過。実装Cursor委譲、Codexレビュー3件対応。
<!-- SECTION:FINAL_SUMMARY:END -->
