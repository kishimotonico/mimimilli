---
id: TASK-96
title: カバー編集UIが計測失敗を「未設定」と誤表示する問題を解消する
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-25 11:01'
updated_date: '2026-07-31 00:50'
labels: []
dependencies: []
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-91でカバー契約を cover: {image, dimensions} | null に統合した結果、カバー画像ファイルは存在するのに寸法計測に失敗した作品が、編集UIで「カバー未設定」と表示されうる。client/src/features/library/ui/preview/DlsiteEditor.tsx:109 が work.cover?.image ?? '未設定' としており、cover が null に落ちる理由が『カバーが無い』のか『あるが計測できなかった』のか区別できないため。表示用の契約(cover)は『表示可能なカバーが無い』を一律nullに投影する設計で正しいが、編集UIは実ファイルの有無を知る必要があり、公開cover越しにしかアクセスできないのがミスマッチ。ユーザーから見ると、実際にはカバー画像があるのに未設定と表示され、上書きして良いのか判断できない。厳密に直すには server/shared に編集専用のフィールド（カバーファイルの有無・計測失敗の別）を追加する必要があり、TASK-91のスコープ外として持ち越したもの。TASK-94で計測結果を判別可能な結果型にする方針と同型の問題なので、あわせて設計すると筋が良い。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 カバー画像ファイルが存在するが寸法計測に失敗した作品で、編集UIが「未設定」と表示しない
- [ ] #2 編集UIが『カバーなし』『カバーあり（計測失敗）』『カバーあり（計測済み）』を区別して提示する
- [ ] #3 表示用のcover契約は『表示可能なカバーが無い』を一律nullに投影する現在の設計を壊していない
- [ ] #4 上記が自動テストで検証されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 編集用契約にカバーファイル有無・計測失敗の別を追加（TASK-94の結果型と同型設計）
2. DlsiteEditorの表示を区別対応
実装Cursor委譲、Codexレビュー実施
<!-- SECTION:PLAN:END -->
