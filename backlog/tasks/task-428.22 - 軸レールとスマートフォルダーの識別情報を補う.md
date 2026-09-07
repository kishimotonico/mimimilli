---
id: TASK-428.22
title: 軸レールとスマートフォルダーの識別情報を補う
status: To Do
assignee: []
created_date: '2026-09-07 09:09'
updated_date: '2026-09-07 19:24'
labels:
  - ui
  - library
  - smart-folder
dependencies: []
modified_files:
  - client/src/features/library/ui/AxisColumn.tsx
  - client/src/entities/library/axisDefinitions.ts
parent_task_id: TASK-428
priority: medium
ordinal: 449000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VIS-09、smart-folders-A-07/A-08/A-18とB重複。軸レールに要件上の件数が配線されず、スマートフォルダー名・作成導線・アイコンも現在地を伝えない。既存集計経路から識別情報を渡す。

スマートフォルダー選択時のパンくずへの対象名表示は TASK-428.15 #3 に寄せ、本タスクでは扱わない（AC重複の整理）。

前提（統合済みの変更）: axisDefinitions.ts には TASK-428.7 が resolveTagPrefix 利用を、TASK-428.15 が isRegisteredFacetAxis（未登録軸URLの判定用、"year"は組み込みで常にtrue・それ以外は登録済みprefixのみ）を追加済み。件数の意味は TASK-428.14 が定義しており、「無条件集計」＝現在の選択タグを一切適用しないその値だけの件数（置き換え既定の入口で使う）と、選択タグ込みの集計（AND追加既定の入口で使う）を区別している。これは TASK-428.11 の「条件一致 N件」（スマートフォルダーのルール一致数）とは別概念。要対応の件数は TASK-428.4 が countNeedsAttention に集約済み（ID重複・読み取り失敗・データ不整合は問題1件=1、RJ未検出・DLsite取得/パース失敗は影響件数を加算）。AC#2「通常件数と要対応badgeを別の意味として併存させる」はこの2つの数え方の違いを踏まえること。TASK-432 が軸ファセットAPIにスマートフォルダー条件を持ち込む予定なので、GET /axes/:axis とサーバー側の評価経路には触れないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全ビュー軸・分類軸・スマートフォルダーに正しい件数を表示する
- [x] #2 通常件数と要対応badgeを別の意味として併存させる
- [x] #3 192px幅で新規作成ラベルが省略されずプラス記号が重複しない
- [x] #4 pnpm test:smokeに新規失敗がない
- [x] #5 スマートフォルダー行のアイコンが「すべての作品」と異なる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
分類軸の件数は「値の個数」で確定（オーナー判断、ADR-0012準拠）。多値タグの重複排除集計API（軸配下の総作品数を正確に返す新規エンドポイント）は起票しない。理由: 1作品が同一軸内で複数値を持ちうる（例: 1作品に複数ジャンル・複数タグ）ため、既存のGET /axes/:axisが返す値ごとのcountを単純合算すると重複作品を二重計上し、「軸配下の総作品数」を正しく算出できない。正確な値を得るには作品ID集合のUNIONをサーバー側で計算する新規集計経路が必要になるが、値の個数（GET /axes/:axisの応答配列長、既存の無条件集計＝TASK-428.14と同じキャッシュキーで取得可能）で軸の規模感を伝えるという設計目的は既に満たしており、総作品数を要求する具体的な利用箇所も無いため、新規APIを起票する理由が無いと判断した。

単位の誤読防止: ビュー軸・スマートフォルダー行は作品数、分類軸・タグ軸・年軸は値の個数と、行によって件数の意味が異なる。軸行のtitle属性（分類軸のみ「値 N件」）とクイックオーバーレイ見出し（AxisValueQuickList、同じitems.lengthを表示）で単位を明示し、軸レール下部のライブラリ統計（作品数表記）との対比で誤解しないようにした。

## 性能計測（fixture large、1000作品、レビュー指摘への対応）

計測対象: 軸レール表示のために新規に発火するようになったeagerクエリ（分類軸7件=CV/サークル/シリーズ/カテゴリ/レーティング/タグ/追加日、ビュー軸3件=最近再生/最近追加/お気に入り、スマートフォルダー2件=fixture large の登録数分）。計12件。既存の集計経路（GET /axes/:axis、GET /works?view=X&limit=1、POST /smart-folders/preview）をそのまま流用しており新規APIは無い。

計測方法: `pnpm preview:fixture:large`（本番ビルド、bunサーバー）をagent-browserのHAR記録＋Performance Resource Timing APIで計測。1000作品・タグ87種・CV16種・サークル18種・シリーズ10種・カテゴリ7種・レーティング0種・スマートフォルダー2件の環境。

結果:
- 新規12リクエストの合計サイズ: 91,228バイト（≒89KB）。ページ全体のAPIリクエスト39件・200,689バイトの内、件数にして約31%、バイト数にして約45%
- 最大は`/api/axes/tag`の52,322バイト（87件の値、レスポンスの大半はcoversサムネイル配列という既存フィールドが占める。件数機能自体が追加したフィールドではない。軸レールの.countは`items.length`だけを使い、covers等は捨てている）
- 12件はnavigationStartから最短90ms・最長167msで全て完了（Performance Resource Timing APIで実測、ブラウザの実際の描画タイムラインに基づく）。ページ全体の初回ロード（JSバンドル258KB gzip込み、総wire転送508KB）と比べて増分は小さく、軸レールの件数表示が体感で遅延する規模ではない
- サーバー側の応答時間自体は各10-50ms程度（開発モードのtimings.waitで確認）で、ネットワーク往復がボトルネックになっていない

判断: 許容範囲と判断し、現状の全軸eager取得のままとする。遅延読み込み（可視範囲のみ取得等）は不要。

留意点（次に見る人向け）: この計測はタグ87種・CV16種規模。分類軸の値数・スマートフォルダー数に比例して増えるため、桁違いに大きい環境（例: タグ数千種）では`/api/axes/tag`のcoversサムネイル配列が支配的コストとして再度膨らむ可能性がある。その場合の対策候補は、件数専用の軽量レスポンス（covers等を含まない）を検討することで、今回は不要と判断したが将来同種の相談が来たら本メモを参照すること。

## 既知の乖離（本タスクでは対応せず記録のみ）

軸レールのエラービュー行の件数（`errorViewCountQueryOptions`、`searchWorks({view:"error"}).total`、TASK-304由来）と、通知ベル・スキャンモーダルの「要対応」件数（`countNeedsAttention`、TASK-428.4）は**別の数え方**。前者はLibraryのstatus!=="ok"作品数、後者はID重複・読み取り失敗・データ不整合（問題1件=1）＋RJ未検出・DLsite取得/パース失敗（影響件数を加算）という別基準の集計。本タスクはAC#2「通常件数と要対応badgeを別の意味として併存させる」の対応としてこの2つの意味の違いを踏まえて実装したが、エラー行自体の集計元を`countNeedsAttention`に統一する変更は本タスクのスコープ外（既存の乖離を温存）。次に軸レールのエラー行を触る人は、この2つの件数が指すものが違うことを踏まえること。
<!-- SECTION:NOTES:END -->
