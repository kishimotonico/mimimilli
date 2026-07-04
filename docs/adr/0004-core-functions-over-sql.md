# ADR-0004: 検索・集計・評価は SQL でなく core の純粋関数で行う

- ステータス: 承認（実装済み）
- 日付: 2026-07-04
- 関連: [ADR-0002](0002-mock-as-fixture-adapter.md)、[ADR-0003](0003-no-db-migrations.md)、[../ARCHITECTURE.md](../ARCHITECTURE.md)

## 文脈

作品検索（`GET /api/works`）・分類軸のファセット集計・スマートフォルダーの評価は、real（SQLite）アダプタと fixture（インメモリ）アダプタの両方で同一の結果を返す必要がある。

## 決定

これらのロジックを SQL クエリに寄せず、アダプタ層は対象データの全件を取得するところまでを担い、実際の絞り込み・集計・評価は `server/src/core/` の純粋関数（`applyWorksQuery` / `buildAxisFacets` / `evalSmartFolder`）に委ねる。

- real アダプタ（`server/src/adapters/real/index.ts`）は `WorkRepo.listSummaries()` で `works` と `work_tags`（JOIN でタグ名を付与）を全件取得し、そのまま core の関数に渡す
- fixture アダプタ（`server/src/adapters/fixture/index.ts`）はインメモリの `WorkSummary[]` をそのまま同じ core の関数に渡す
- `work_tags` テーブル自体は作品とタグ名の多対多関係の永続化には使うが、タグ AND/OR フィルタや軸絞り込みの条件評価は SQL の `WHERE` ではなく JS 側（`worksQuery.ts` の `filterByTags` 等）で行う

## 帰結

- 検索・集計・評価のロジックが1系統になり、real / fixture 間で挙動が一致することが構造的に保証される。純粋関数なので単体テストも容易
- 全件をメモリに読み込んで処理するため、作品数の増加に伴いスケールしない。想定規模（数千作品）では問題にならないが、性能問題が顕在化したら本 ADR を見直して SQL 化（または一部のみのオフロード）を検討する
- [requirements-v4.md](../requirements-v4.md) §4.3 が想定していた「SQLite の多対多リレーションでタグ検索を実装する」という記述は、この決定によって置き換えられた（DB はリレーションを保持するが、検索ロジック自体はここに記載の通り SQL には寄せていない）
