---
id: TASK-515
title: スキャンで作品情報ファイルを読むあいだも進捗を出す
status: Done
assignee: []
created_date: '2026-11-21 15:46'
updated_date: '2026-11-21 17:13'
labels: []
dependencies: []
priority: medium
ordinal: 600000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2000作品超の環境で、スキャンの進捗が0/2080のまま数十秒止まり、急に完了になる。登録フェーズの前に全作品情報ファイルの読み取りと判定（server/src/adapters/real/scanner.ts の prepareEntries: inspectMetaFiles・prepareMetaEntries、buildProbeCache）を同期でまとめて行い、そのあいだ進捗を出していないため。変更のない作品は登録ループで即スキップされるので、登録の進捗は一瞬で終わる。読み取りの段階を進捗に数え、止まって見えないようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 作品情報ファイルの読み取りと判定のあいだ、1件ずつ（間引きは既存の進捗と同じ間隔で）processed/total の進捗を出す
- [x] #2 読み取りの段階は独立したフェーズとして画面に出し、文言は実際の作業に合わせる（変更のない作品しかないときに「作品を登録中」と出さない）
- [x] #3 フェーズ名と表示文言の対応をクライアントで1か所にする（今は entities/scan と features/scan に重複している）
- [x] #4 読み取り中も中止の要求に応じる
- [x] #5 scanner の進捗の順序と件数をテストで縛る
- [x] #6 pnpm check && pnpm test && pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fable（サーバー）と Opus（クライアント・フィクスチャ・docs）のレビューを反映し、master に --no-ff マージ。別PCのドッグフーディングで見え方を確認する。
<!-- SECTION:NOTES:END -->
