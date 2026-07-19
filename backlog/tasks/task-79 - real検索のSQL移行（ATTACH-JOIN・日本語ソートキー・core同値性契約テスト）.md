---
id: TASK-79
title: real検索のSQL移行（ATTACH JOIN・日本語ソートキー・core同値性契約テスト）
status: To Do
assignee: []
created_date: '2026-07-19 05:07'
labels: []
dependencies:
  - TASK-78
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008の実装第2弾（DRAFT-25の実現）。TASK-78のDB分離が前提。

やること:
- realアダプタの作品一覧・検索・ソート・件数・ページングを、全件メモリ処理（core/worksQuery経由）からATTACH JOINのSQLへ移行。coreの純粋関数は仕様の正本・fixture実装・参照実装として残す（ADR-0008「検索・ソート・ページングの所有権」参照）
- 日本語向け事前計算ソートキー: core所有の関数（NFKC+カタカナ→ひらがな折りたたみ+lowercase）で生成し、catalogの派生キャッシュ列に保存。SQLはそのキーのバイト順で並べる。localeCompare("ja")は廃止（ADR-0008修正版参照）
- 全ソートにwork_id ASCの最終タイブレーカー。randomソートはseed契約（ADR-0008参照）
- core純粋関数とSQLの同値性を契約テストで保証（同一fixtureを両方に投入して順序付きID列・total・ファセットを比較）
- TASK-73/74（ページングAPI適用）のreal側実装はこのタスクに統合する（契約・client側は各タスクで先行可）

性能目標: 数千〜30,000件規模で一覧APIがページングで応答できること（TASK-57のN+1解消もSQL化で同時に解消される）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 realの一覧・検索・ソート・ページングがSQLで実行され、全件メモリロードが解消されている
- [ ] #2 日本語ソートキーの派生列で並び、coreとSQLの同値性契約テストが通る
- [ ] #3 bookmarked・lastPlayedAt・addedAt等のuser条件を含む絞り込み・ソート・ページングが正確
- [ ] #4 pnpm check と pnpm test が通る
<!-- AC:END -->
