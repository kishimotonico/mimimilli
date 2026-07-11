---
id: TASK-34
title: DLsite連携状態モデルの導入（rjCode・status・エラーの永続化）
status: Done
assignee: []
created_date: '2026-07-10 10:29'
updated_date: '2026-07-11 20:13'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DLsite連携の状態を .meta.json と SQLite に永続化する。DLsite改修（TASK-35/36/37）の土台。

## 決定済み仕様（2026-07-12、簡素化方針）
.meta.json に dlsite オブジェクトを1つ追加する:

dlsite: {
  rjCode: string | null,      // 検出値。手動上書き可（上書きUIはTASK-36）
  status: "none" | "applied" | "not_found" | "error" | "skipped",
  lastAttemptAt: string | null,  // 最終取得試行日時（ISO）
  error: string | null,          // status=error/not_found時の理由
  appliedTags: string[]          // 最後に適用したタグ集合（削除タグ復活防止の差分基準）
}

- pending/fetchedは永続化しない（取得中=ジョブのメモリ内、プレビュー=UI状態）
- フィールド未定義のメタは none 扱い。マイグレーション不要（メタが常に勝つ原則のまま）
- skipped = 「RJコードはあるが連携しない」というユーザー意思。一括ジョブのスキップ判定に使う
- appliedTags差分の適用ルール:「新infoにあって前回appliedTagsにないタグだけ追加」。ユーザーが削除したタグを再適用が復活させない

## 実装ガイド
- shared: dlsite状態のZodスキーマを追加し、Work / WorkSummary に載せる（Summaryはバッジ表示で使う）
- real: DBは works へのカラム追加ではなく新テーブル（例 work_dlsite: work_id PK + JSON）を推奨。db.ts の DDL は CREATE TABLE IF NOT EXISTS 方式でSCHEMA_VERSION据え置きにできる（ADR-0003参照。worksへのALTERは既存DB破棄を強いるため避ける）
- スキャン取り込みでメタ→DB同期、状態更新時はメタ書き戻し（既存のpatchMetaFileパターン。スキーマ外フィールド保持を維持）
- スキャン時に rjCode 未設定なら detectRjCode（フォルダー名→タイトル）で検出して保存（取得はしない。取得はTASK-37）
- fixtureアダプタにも同じ状態を持たせる（シナリオに数作品ぶんの状態サンプル）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 メタにdlsiteオブジェクトが永続化され、再スキャンでDBに復元される
- [x] #2 dlsiteフィールドのないメタはstatus=none扱いで読める（既存ライブラリがそのまま動く）
- [x] #3 スキャンでrjCodeが自動検出されて保存される（取得はまだしない）
- [x] #4 Work/WorkSummary契約にdlsite状態が載り、real/fixture両アダプタで返る
- [x] #5 server/sharedのテストが通る（pnpm check / pnpm test）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DLsite状態スキーマをshared契約とメタへ追加する
2. work_dlsiteテーブルとリポジトリ変換を追加し、スキャン時のRJコード検出・メタ同期を実装する
3. real/fixtureアダプタの状態更新・返却とテストを追加する
4. pnpm check / pnpm testを通し、AC・final-summaryを更新してコミットする
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
work_dlsite専用テーブルに状態JSONを保持し、スキャンではメタを正として同期する。RJコード未設定時はフォルダー名、タイトルの順で検出してメタへ書き戻す。検証: pnpm check / pnpm test（server 124件、client 140件）成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite連携状態をshared契約、.meta.json、SQLite、real/fixtureアダプタへ追加した。既存メタはnoneとして読み、スキャン時のRJコード検出と再スキャン復元を結合テストで確認した。pnpm check / pnpm test成功。
<!-- SECTION:FINAL_SUMMARY:END -->
