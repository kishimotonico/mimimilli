---
id: DRAFT-27
title: DBのカタログ/ユーザーデータ分離とマイグレーション導入（ADR-0003見直し）
status: Draft
assignee: []
created_date: '2026-07-19 03:09'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘1,10。ADR-0003は「スキーマ不一致でDB作り直し」を選び、失われるユーザーデータ（app_settings・search_presets・smart_folders・bookmarked・last_played_at・resume_position等）を既知のトレードオフとして自認している（「損失の影響が無視できなくなったら見直す」）。レビューは、ユーザーデータが増えるほどアプリ更新がデータ消失イベントになると指摘。

方向性: 再構築可能なカタログDB（スキャン由来）と永続ユーザー状態を物理分離し、後者にマイグレーションを導入。最低限でもスキーマ更新前の自動バックアップ。あわせてDDL手書きとDrizzleスキーマの手動二重管理（db.ts/schema.ts、指摘10）をDrizzle migration正典化で解消する。

見直しトリガーの目安: レジューム・ブックマーク・スマートフォルダー等の蓄積が「作り直しでいいや」と言えなくなったとき。配布（DRAFT-1: Bun compile単一exe）を進めるなら一般ユーザーが使う前提になるため、その前に必須。DRAFT-1側の知見: 配布形態はDB・画像処理(sharp)・静的アセット・データ配置を決めるアーキテクチャ要件なので、CIでWindows用exeの生成・起動を早期に成立させるべき（指摘2）。
<!-- SECTION:DESCRIPTION:END -->
