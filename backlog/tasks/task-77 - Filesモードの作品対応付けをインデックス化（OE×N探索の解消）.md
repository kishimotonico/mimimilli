---
id: TASK-77
title: Filesモードの作品対応付けをインデックス化（O(E×N)探索の解消）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 04:27'
updated_date: '2026-07-22 18:38'
labels: []
dependencies: []
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー（2026-07-19）で未タスク化と指摘された項目。browseFs()（server/src/adapters/real/fsBrowse.ts:26/57/68）が全summaryを取得し、ディレクトリエントリごとに works.find()、ファイルごとに全作品からowner探索するO(E×N)。ルート直下に大量エントリがあると顕著。physicalPath→workIdのMapと祖先探索用のパスインデックスを構築して解消する。TASK-57（listSummaries改善）だけではsummary取得コストは下がるが探索量は残る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 browseFs のエントリ・ファイルごとの探索が全件線形探索でなくなる（Map/パスインデックス）
- [x] #2 既存のFilesモードの表示・作品対応付けが退行しない
- [x] #3 pnpm check と pnpm test が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. browseFs呼び出しごとにphysicalPath→WorkSummaryの先勝ちMapを一度構築し、listing自身とdirectory entryの完全一致をO(1)化する 2. file ownerはdirnameをroot境界まで上るMap祖先探索へ置換し、nested workでは最深root、prefix類似パスは非一致、workRelPath生成の現行契約を維持する 3. root配下外・未登録・管理ファイル非表示・自然順など既存Files契約を維持する 4. 既存結合テストにnested root、prefix境界、duplicate physicalPath先勝ち、未登録を追加し、lookup statsで作品数Nに比例する走査がないことを検証する 5. pnpm check、関連テスト、pnpm test、Files画面のブラウザ確認を別担当で実施する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装: browseFs開始時にphysicalPath→WorkSummaryの先勝ちMapを一度構築。listing自身とdirectory entryは完全一致O(1)、file ownerはroot境界までdirnameを遡るMap lookupとし、nested作品では最深root、prefix類似パスは非一致、duplicate physicalPathは従来どおり先勝ちを維持した。計算量はO(N + E×階層深さ)。検証: pnpm check成功、pnpm testはserver 255/client 293件成功。fsBrowse 5件を3回反復して全成功し、10,001作品でもowner探索は3 Map.getに固定。ブラウザでFiles階層、作品タイトル、先頭音声再生、API 200、Range 206、console/network errorなしを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Filesモードの作品対応付けをphysicalPath索引と祖先Map探索へ変更し、エントリごとの全作品線形走査を解消。既存の完全一致・最深owner・相対パス契約を維持し、性能回帰テスト、全チェック、全テスト、ブラウザ操作で確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
