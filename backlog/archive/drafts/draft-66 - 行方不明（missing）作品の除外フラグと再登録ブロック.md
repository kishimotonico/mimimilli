---
id: DRAFT-66
title: 行方不明（missing）作品の除外フラグと再登録ブロック
status: Draft
assignee: []
created_date: '2026-08-18 23:12'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-23 の本文を現状に合わせて書き直したもの（2026-08-19の棚卸し）。旧本文の「DELETE エンドポイントが存在せず、missing作品を消す手段が実質ない」という前提は解消済み。

## 解消済みの前提

- `DELETE /works/:id` は実装済み（`server/src/routes/works.ts:108-109`、結合テストは `server/tests/real/workUnregister.test.ts`）
- ファイルモードからの削除導線も実装済み（`client/src/features/files/ui/FilePreview.tsx:80-81` の `deleteWork`）
- missing軸は TASK-304 で廃止され、包括エラービュー（`view: "error"`、`status !== "ok"` を含む）に統合済み（`server/src/core/worksQuery.ts:140-141`）
- ライブラリ画面からの削除導線は TASK-299（To Do）が担当。一括削除は DRAFT-53

つまり旧案Aは大部分が別タスクで消化された。

## 残っている本題

スキャン完了時に `markMissingExcept`（`server/src/adapters/real/workRepo.ts` 付近、呼び出しは `scanner.ts`）が「今回見つからなかった作品」を一括で missing にする。ユーザーが登録したくない作品のメタデータを意図的に消した場合も無条件で missing になり、**「意図的な除外」という概念が存在しない**。削除しても再スキャンで復活しうる。

未実装の方向性:
- 案B: Work に `excludedAt` 等の除外フラグを追加し、スキャン・通知・欠損バッジから隔離する。DLsite連携の skipped ステータス（`shared/src/dlsite.ts`、`WorkStatusWarnings.tsx`）と同じUXパターン。要DBマイグレーション。2026-07-19の調査時点の推奨
- 案C: フォルダーパス単位の再登録ブロックリスト。メタ削除後も音声フォルダーが残っていると scanner の自動生成で復活するケース向け

## 進め方

TASK-299（ライブラリからの削除導線）が入ると「削除したのに再スキャンで戻ってくる」が実際に踏まれるようになるので、そのあとで除外フラグの要否を判断するのが自然。着手を決めたら、まず案B/Cのどこまでやるかを固める要件タスクを切ること。
<!-- SECTION:DESCRIPTION:END -->
