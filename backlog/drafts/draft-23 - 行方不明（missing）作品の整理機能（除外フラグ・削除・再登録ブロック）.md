---
id: DRAFT-23
title: 行方不明（missing）作品の整理機能（除外フラグ・削除・再登録ブロック）
status: Draft
assignee: []
created_date: '2026-07-18 20:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
背景: スキャン完了時に markMissingExcept（server/src/adapters/real/workRepo.ts:270-277、呼び出しは scanner.ts:313）が「今回見つからなかった作品」を一括で missing にする。ユーザーが登録したくない作品のメタデータを意図的に消した場合も無条件で missing になり、「意図的な除外」という概念が存在しない。さらに works への DELETE エンドポイントが存在せず（routes/works.ts）、missing 作品を消す手段が実質ない。

検討済みの方向性（2026-07-19調査）:
- 案A: WorkRepo.deleteWork + DELETE /works/:id + 削除UI（「ファイル欠損」ビューからの一括削除含む）。最小工数だが再スキャンで復活しうる
- 案B: Work に excludedAt 等の除外フラグを追加し、スキャン・通知・欠損バッジから隔離。DLsite連携の skipped ステータス（shared/src/dlsite.ts:72-83、WorkStatusWarnings.tsx:39-56）と同じUXパターン。要DBマイグレーション。調査時の推奨は B+A 併設
- 案C: フォルダーパス単位の再登録ブロックリスト（メタ削除後も音声フォルダーが残っていると scanner.ts:284-310 の自動生成で復活するケース向け）

2026-07-19時点でユーザー判断により着手見送り。着手を決めたらまず要件（どの案をどこまでやるか）を固めるタスクを切ること。
<!-- SECTION:DESCRIPTION:END -->
