---
id: TASK-141
title: 作品とメタファイルパスの対応を固定し別作品の.meta.json誤書き換えを防ぐ
status: To Do
assignee: []
created_date: '2026-07-30 12:33'
labels: []
dependencies: []
priority: high
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
単一ファイル形式（foo.meta.json）の作品を編集すると、同居する .meta.json（別作品）を書き換えうる（敵対的検証済み・Codexレビュー指摘#2）。SoT破壊の可能性がある重大バグ。

事実:
- server/src/adapters/real/meta.ts:11-13 isMetaFileName は .meta.json と *.meta.json の両形式を許可し、scannerのwalk()は同一ディレクトリ内の全メタファイルを個別の作品として登録する（縮約ロジックは存在しない）。同居が可能
- server/src/adapters/real/index.ts:1143-1158 findMetaPath は physicalPath から join(physicalPath, ".meta.json") を最優先で返すため、単一ファイル形式作品の書き戻し（index.ts:713,881,908,1009,1071,1107 の patchMetaFile 呼び出し）が同居する .meta.json に向かう

方向: catalog に正規化済み metaPath を保存し、書き戻し・エラー帰属は必ずその値を使う。もしくは同一ディレクトリへの複数メタ同居をスキャン時に明示的な整合性エラーとして拒否する（どちらにするかは実装時に判断。前者が要件に忠実）。

関連: DRAFT-28の「meta/DB整合」とも関係するが、これは具体的なデータ破壊バグとして単独で修正する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 単一ファイル形式の作品の編集が、同居する .meta.json を書き換えないことをテストで確認している
- [ ] #2 書き戻し先メタパスの解決がスキャン時に確定した正規化済みパスに一本化されている（または同居がスキャン時に整合性エラーとして拒否される）
- [ ] #3 pnpm check・pnpm test:server が通る
<!-- AC:END -->
