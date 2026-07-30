---
id: TASK-153
title: 作品PATCH時のworks無限クエリ全ページ再フェッチを廃止する
status: To Do
assignee: []
created_date: '2026-07-30 17:53'
labels: []
dependencies: []
priority: high
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/features/library/model/useLibraryQueries.ts:184-194のpatchWorkMutation.onSuccessがinvalidateQueries({queryKey:["works"]})を呼び、無限スクロールで蓄積した全ページ（200件×N）の順次再フェッチと["works","total"]の無効化が起きる。詳細側（WORK_QUERY_KEYS.detail）には既にsetQueryDataによる直接更新パターンがあるため、一覧側にも展開する。ただしタグ・ブックマーク等の変更はフィルタ所属・ソート順に影響しうるため、「DTOの差し替え（直接更新）」と「所属・順序の再評価（限定的invalidate）」を棚分けする設計が必要（Codexレビュー指摘）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 フィルタ・ソート結果に影響しないPATCH（例: タイトル編集）では一覧クエリの再フェッチが発生せず、キャッシュ内DTOが直接更新される
- [ ] #2 フィルタ所属・ソート順に影響しうるPATCHの扱いが設計として明示され、必要な範囲だけ再評価される（全ページ順次再フェッチには戻さない）
- [ ] #3 総件数（total）が不必要に無効化されない
- [ ] #4 pnpm check と pnpm test が通る（挙動の退行テストを追加）
<!-- AC:END -->
