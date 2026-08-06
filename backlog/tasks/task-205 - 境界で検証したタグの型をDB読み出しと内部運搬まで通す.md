---
id: TASK-205
title: 境界で検証したタグの型をDB読み出しと内部運搬まで通す
status: Done
assignee: []
created_date: '2026-08-06 04:56'
updated_date: '2026-08-06 08:05'
labels: []
dependencies: []
priority: high
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-203/204 でタグの正規化済み不変条件を NormalizedTag 型で表明したが、対象範囲が work.tags と HTTP 境界の入力に限定され、隣接する3箇所が取り残されている。3つとも「境界の parse 結果を型で内側まで運んでいない」という同一の構造的欠落から生じている。

## 1. DB 読み出し境界が無検証のキャスト

shared/src/work.ts:132-134 の normalizedTagArraySchema は z.array(z.string()).transform((tags) => tags as NormalizedTag[]) で、実行時には何も検証していない。このコードベース唯一のブランド型 NormalizedTag のキャスト4箇所のうち、正規化ロジックを通していないのはここだけ（他は normalizeTag 内の2箇所と buildBuiltinAxisTag で、いずれも正当）。

同じ rowToWork / rowToSummary（server/src/adapters/real/workRepo.ts:221-244, 266-316）は urls や playlists_json の不変条件違反では既に PersistentDataError を投げており、tags だけがこの規律から外れている。旧データや手動 DB 編集で非正規タグが入ると tagEquals の === 比較や parseBuiltinAxisTag の @ 判定が黙って誤動作する。

扱いは「エラーにする」が妥当。読み飛ばしは作品のタグが黙って一部消える最も気づきにくい壊れ方になり、正規化して返すのは書き込み時の tagSchema をすり抜けた値を API がこっそり書き換えて原因を隠すことになる。

性能は実測済みで問題にならない。3万作品・22.5万タグ文字列の一括正規化が中央値29.8ms。さらに queryWorks() の一覧経路は tags 列を SELECT せず rowToSummary を通らないため、検証コストが乗るのは作品詳細1件表示と低頻度バッチ（export・DLsite一括・スキャン後の照合）だけで、そのバッチは元々数百ms〜秒オーダー。

DB の CHECK 制約で担保する案は、tagSchema の正規化ルールを SQL へ複製することになり ADR-0004（コアロジックは SQL でなく TS 関数で持つ）に反するため採らない。書き込み経路は WorkRepo.replaceWorkTags の1本に絞られており型で守られているので、書き込み側は型・読み出し側は parse の両輪にする。

## 2. dlsite.appliedTags が同じ契約から外れている

shared/src/dlsite.ts:16 の appliedTags は z.array(z.string()) のままで、NormalizedTag 型でもなければ tagSchema も通っていない。shared/src/meta.ts の metaFileSchema は tags に「外部からの直接編集や旧データにも予約文字契約を効かせる」とコメント付きで変換をかけているのに、同じスキーマ内の dlsite は素通し。

結果として消費側が生文字列として扱い、使う直前に normalizeTags を手動で再実行する防御コードを複製している（server/src/adapters/real/index.ts:929,1103、server/src/adapters/fixture/index.ts:836,887 ほか計7箇所）。work.tags 側に同種の再正規化はゼロ。比較も index.ts:1092,1112 で tagEquals を使わない素の string 比較になっている。

## 3. WorksQuery.tags が境界の parse 結果を捨てて再パースされている

HTTP 境界（shared/src/api.ts:25-30 の refineTagWarnings）で splitSelectedTags を通して不正入力を拒否した後、WorksQuery.tags の型は素の string[] のまま。そのため core/worksQuery.ts:111-117 の resolveTagFilters と workRepo.ts:840,1175 が同じ入力をもう一度 splitSelectedTags にかけて構造化し直している。「tags= パラメータが実タグと擬似タグの混在である」という事実は境界だけが知っていればよく、内側は構造化済みの値を受け取る契約にすべき。

対象: shared/src/work.ts / shared/src/dlsite.ts / shared/src/meta.ts / shared/src/api.ts / server/src/core/worksQuery.ts / server/src/adapters/real/workRepo.ts / server/src/adapters/real/index.ts / server/src/adapters/real/smartFolderWorks.ts / server/src/adapters/fixture/index.ts

判断の基準: 実装コストや影響範囲の広さを理由に見送らないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizedTagArraySchema が実際に検証を行い、正規化されていないタグを含む行の読み出しが既存の不変条件違反と同じ PersistentDataError 経路でエラーになる
- [ ] #2 dlsite.appliedTags が work.tags と同じ正規化契約を通り、消費側の防御的な normalizeTags 再実行（計7箇所）が削除されている
- [ ] #3 appliedTags の比較が tagEquals ベースに統一され、素の string 比較が残っていない
- [ ] #4 WorksQuery および関連クエリの tags が境界で構造化された形で内側へ渡り、core・adapter 層が splitSelectedTags を呼ばなくなっている
- [ ] #5 型エラー回避目的の as キャストが導入されていない
- [ ] #6 worksQueryContract のランダム生成契約テストが通り、fixture と real の同値性が保たれている
- [ ] #7 pnpm check と pnpm test と pnpm test:visual が通る
- [ ] #8 dlsiteApplyBodySchema.applyTags（POST /api/works/:id/dlsite/apply のボディ）も work.tags と同じ tagSchema 変換を通り、受信直後の手動 normalizeTags（real/fixture 各1箇所）が削除されている
- [ ] #9 listSummaries() を使う集約処理（エクスポート・DLsite一括取得・スキャン完了処理・ルールベースのスマートフォルダー）が、非正規タグを持つ作品が1件あっても全体停止せず、該当作品を隔離して残りの処理を続行する
- [ ] #10 隔離された作品は黙って捨てられず、件数と対象がログに記録され、UIのある経路ではユーザーに提示される
- [ ] #11 3万作品規模で listSummaries() の所要時間の増加が master 比で有意でない水準まで抑えられており、smart-folder-with-rules のHTTP応答が master 比で明確な悪化を示さない（bench で master と比較実測し数値を報告する）
- [ ] #12 ユニークタグ数が数万規模（20,000・50,000）でも性能が劣化せず、キャッシュ等の内部最適化に閾値を境とした性能の崖が存在しない
<!-- AC:END -->
