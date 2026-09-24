---
id: TASK-467
title: 作品の配置形式をscan・登録の境界で確定し、後段で再推測しない
status: To Do
assignee: []
created_date: '2026-09-24 07:22'
labels:
  - refactor
  - architecture
  - scan
  - register
dependencies: []
priority: medium
ordinal: 521000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: docs/architecture-review-2026-09-20.md R5。単一ファイル作品を含む現在のモデルに対する指摘。

現在のコード根拠:
- shared/src/meta.ts（isAudioWorkPath、workMediaRoot）
- server/src/adapters/real/catalogSchema.ts（location保存）
- server/src/adapters/real/workProbe.ts
- server/src/adapters/real/coverMediaMethods.ts
- server/src/adapters/real/workRegister.ts

isAudioWorkPathは末尾拡張子だけでフォルダー/単一ファイルを判定し、workMediaRootがその結果でメディアの基準ディレクトリを変える。この推測は再生時間取得・カバー配信・DLsite画像保存・登録解除に波及している。

決定事項（統括判断、新しいADRに記録する）:
- scan・登録の境界で配置形式を確定し、後段は拡張子から再推測しない。
- まず保存済みmetaPathから媒体の基準ディレクトリを解決する小さなモデルを検討する。形式差が必要な箇所にはfolder/audio-fileの判別型を渡す。
- physicalPath/metaPath/mediaRoot/kindを独立した永続列として増やしすぎない。導出できる値は導出する。
- 不整合な配置は推測で補わず、エラーとして扱う。
- 後方互換は維持しない。既存catalog/metaに残る旧解釈のデータへの移行が必要な場合、手動コマンド例をADRに残す。

R5とDLsite導線再設計（DRAFT-74/76）の重なりは薄い（配置形式の確定はDLsite取得とは別軸）。ただしworkRegister.tsはDLsite関連コードとも接続するため、実装順で衝突しないよう確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新しいADRで配置形式(folder/audio-file)の判別モデル(metaPath起点の解決)・永続列を増やしすぎない方針・既存meta/catalogへの手動移行コマンド例を記録している
- [ ] #2 isAudioWorkPath等の拡張子推測に代わり、登録・scan時点で確定した配置形式を後段(再生時間取得・カバー配信・DLsite画像保存・登録解除)が参照する
- [ ] #3 配置が不整合な場合はエラーとして扱われ、推測で補わない
- [ ] #4 workProbe・coverMediaMethods・workRegister関連の既存テストが通り、判別型による分岐をテストで縛る
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->
