---
id: TASK-141
title: 作品とメタファイルパスの対応を固定し別作品の.meta.json誤書き換えを防ぐ
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 12:33'
updated_date: '2026-07-30 16:16'
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
- [x] #1 単一ファイル形式の作品の編集が、同居する .meta.json を書き換えないことをテストで確認している
- [x] #2 書き戻し先メタパスの解決がスキャン時に確定した正規化済みパスに一本化されている（または同居がスキャン時に整合性エラーとして拒否される）
- [x] #3 pnpm check・pnpm test:server が通る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スキャン時に確定したmetaPathをcatalogへ保存（列追加+CATALOG_SCHEMA_VERSION bump）
2. 書き戻し・エラー帰属をfindMetaPath逆算からcatalogのmetaPath参照へ一本化
3. .meta.json同居ケースの回帰テスト
4. pnpm check + pnpm test:server
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursor(composer-2.5)で実装+1回差し戻し（migration履歴再現テストのNOT NULL衝突修正）。worksへmeta_path NOT NULL列を追加しCATALOG_SCHEMA_VERSIONを7へbump（既存catalogは再作成＝次回起動時に一度だけ全再プローブが走る。NOT NULL追加のため不可避）。findMetaPath/getWorkMetaLocationの逆算経路を全廃しupsertWork(work,{metaPath})に一本化。metaWriteback.test.tsに同居ケースの回帰テスト追加。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スキャン時に確定したメタファイル実パスをcatalogに保存し、書き戻し・エラー帰属をmetaPath参照へ一本化。単一ファイル形式作品の編集が同居する.meta.jsonを書き換える事故を防止。
<!-- SECTION:FINAL_SUMMARY:END -->
