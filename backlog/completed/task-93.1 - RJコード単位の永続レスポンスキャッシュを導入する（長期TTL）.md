---
id: TASK-93.1
title: DLsiteレスポンスHTMLの永続キャッシュを導入する（長期TTL）
status: Done
assignee: []
created_date: '2026-07-25 08:39'
updated_date: '2026-07-26 02:02'
labels: []
dependencies: []
parent_task_id: TASK-93
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## やること

作品レコードから独立した、DLsiteレスポンスの永続キャッシュを新設する。

キャッシュするのは**パース済みDTOではなく生のレスポンスHTML**。キャッシュの目的はDLsiteの実サーバーへのアクセスを減らすことであって、パース処理の省略ではない。HTMLで持てば、パーサを改修したあとも同じHTMLに対して繰り返しスキャンをかけて挙動を確認でき、キャッシュ側でパーサのバージョンを管理する必要もなくなる。

### 保存先

**専用の SQLite ファイル（dlsite-cache.sqlite）を1つ作り、HTML本体もメタデータも同じDBに置く。** catalog DB（スキャンで再構築される側）にもuser DBにも入れない。作品を消してもcatalog DBを作り直してもキャッシュが残ることが要件。

HTML本体はgzip圧縮してBLOBカラムへ入れる。本体をファイル、インデックスをDBに分ける案も検討したが、「DB行はあるがファイルがない」「gzipが壊れている」「ファイルだけあるorphan」「更新途中のクラッシュで本体とメタが食い違う」の整合性ルールを個別に設計する必要が出るため採らない。単一DBなら本体・outcome・TTLを1トランザクションで更新でき、この分類が丸ごと不要になる。

### outcome の分類

**「HTTP取得の成否」と「パースの成否」を分ける。** 現状は200レスポンスを直ちにパースし、タイトルが取れなければエラー扱いになる（server/src/adapters/real/dlsite.ts:76）。200でbot challengeや年齢確認ページが返る可能性があり、これを ok として30日キャッシュすると事故になる。

- ok: 2xxかつパース成功
- parse_error: 2xxだがパース失敗。HTML本体は診断用に保存するが ok のTTLは適用しない
- not_found: 404
- error: 5xx・ネットワークエラー・429（再試行抑制用のnegative cache。HTML本体は持たない）

### TTL

既定値（環境変数で上書き可能にする）:

- ok: 30日
- parse_error: 1時間（パーサ改修中に何度も取りに行かない程度に留める）
- not_found: 3日
- error: 1時間。ただし429/503は Retry-After またはそれ用の短いcooldownに従う（TASK-93.3）

TTL切れは「エントリを消す」のではなく「期限切れとして扱い再取得する」。再取得が失敗した場合に期限切れエントリへフォールバックすることはしない（エラーは隠蔽しない）。ただし本体は即削除せず保持しておき、通常のgetでは使わない方針とする（デバッグ時に古いHTMLを参照できる）。

### キャッシュキー

裸のRJコードではなく名前空間付きにする。今は maniax/pro がコードprefixから一意に導出できる（dlsite.ts:18-21）ため実質同じ結果になるが、URL規則の変更やページ種別の追加時に移行しやすくなる。

- resource_kind（work_html 等）
- store（maniax | pro）
- product_code（RJ/VJコード）
- representation（取得URL・Cookie・言語といったHTTP表現のバージョン。パーサのバージョンではない）

product_code はキー化前に trim・大文字化・形式検証を必須とする。

### 入力の検証と上限

外部からのレスポンスをそのまま保存するため、次を必須とする。

- Content-Type の検証
- 1レスポンスあたりの最大転送サイズと、gzip展開後の最大サイズの上限
- 上限超過は保存せずエラーとする

### 容量

DLsiteの作品ページHTMLは1ページあたり数百KB規模。gzipで概ね1/8〜1/10に落ちる見込みだが、実際の圧縮率は実測して実装メモに記録すること。1万作品でも数百MB規模に収まる想定。

- キャッシュDBの現在のサイズを確認できる手段
- 期限切れエントリを削除するクリーンアップ手段（自動削除ではなく明示的な操作）
- ディスクフル時に失敗を握りつぶさないこと

上限サイズによる自動退避（LRU等）は入れない。TTLとクリーンアップで足りるかを運用して判断する。

### 外部からのキャッシュ投入

外部で取得済みのHTMLを流し込む import コマンドを用意する。「ディレクトリにファイルを置くだけで自動再構築」はしない（ファイルからは fetched_at や outcome を復元できないため）。import 時は投入時刻を fetched_at とし、HTMLを検証して outcome を決める。symlink や gzip bomb は拒否する。

### スコープ外

呼び出し元の統合はTASK-93.2、レート制限・リトライ・オフラインフラグはTASK-93.3で扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 専用SQLite（dlsite-cache.sqlite）が追加され、gzip圧縮したHTML本体とメタデータが同一DB・同一トランザクションで更新される
- [x] #2 キャッシュはcatalog DBの再構築や作品の削除・再登録で消えない
- [x] #3 outcome が ok / parse_error / not_found / error に分かれ、2xxでもパースに失敗したものは ok として扱われない
- [x] #4 parse_error のHTML本体は診断用に保存されるが、ok のTTLは適用されない
- [x] #5 outcomeごとに独立したTTLがあり、既定値は ok=30日 / parse_error=1時間 / not_found=3日 / error=1時間である
- [x] #6 TTLとキャッシュDBのパスは環境変数で設定でき、既定値のハードコードが1箇所に集約されている
- [x] #7 Content-Type・最大転送サイズ・gzip展開後の最大サイズが検証され、上限超過は保存されずエラーになる
- [x] #8 キャッシュDBのサイズを確認する手段と、期限切れエントリを明示的に削除するクリーンアップ手段がある
- [x] #9 外部で取得済みのHTMLを投入するimportコマンドがあり、symlinkとgzip bombを拒否する
- [x] #10 hit / miss / TTL境界 / outcome別TTL / サイズ上限超過 を網羅する単体テストがあり、実ネットワークへアクセスしない
- [x] #11 キャッシュキーが store / product_code / representation の名前空間付きで構成され、product_code はtrim・大文字化・形式検証を経る
<!-- AC:END -->







## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. dataRootの既存命名に合わせ、既定パスを <MIMIKAGO_DATA_DIR>/db/dlsite-cache.sqlite とする。通常起動では MIMIKAGO_DLSITE_CACHE_DB を任意の絶対パス上書きとして受け、テストは RealAdapterOptions の dlsiteCache 設定でDBパス、TTL、最大転送サイズ、最大展開サイズ、clockを注入できるようにする。
2. bun:sqliteで専用ストアを実装する。キーは resource_kind / store / product_code / representation とし、product_codeはtrim後に大文字化して RJまたはVJに6〜8桁の数字が続く形式を検証する。storeはRJ→maniax、VJ→proへ正規化する。初期representationはHTTP表現だけを表す固定値 work-html-ja-adultchecked-v1 とし、パーサのバージョンを含めない。
3. HTMLはgzip BLOB、メタデータは同一SQLite行に保存し、更新は1トランザクションで行う。store APIは outcome（ok / parse_error / not_found / error）を呼び出し側から明示的に受け取る。ストア自身はHTMLをparseしない。TTLはok=30日、parse_error=1時間、not_found=3日、error=1時間を既定値として集約し、期限切れ行は通常getで返さず、期限切れ値へのフォールバックもしない。
4. HTTP統合前の本タスクではlive HTTP経路を変更しない。importだけが parseDlsiteHtml を呼んでoutcomeを決める。Content-Type、転送サイズ、gzip展開後サイズを検証し、上限超過は保存せず失敗にする。
5. serverのpackage scriptとして dlsite-cache CLIを追加し、status（DBサイズ・件数）、cleanup（期限切れ行の明示削除）、import --product-code <RJ|VJ> --file <path> を提供する。importは通常ファイルかつ .html 1件だけを受け、symlink・gzip入力を拒否する。同一キーは既存行をtransaction内で上書きする。
6. 一時SQLiteとfake clockだけでhit/miss、TTL境界、outcome別TTL、期限切れ非返却、正規化、gzip BLOB、サイズ上限、CLI status/cleanup/import、symlink・gzip拒否、同一キー上書きを試験する。実ネットワークは使わない。期限切れ後の再取得失敗伝播と、取得済み実ページ試料での容量・圧縮率測定はTASK-93.2で確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ストアはoutcomeを明示入力とし、parseDlsiteHtmlによる判定はimportだけが担当する。live HTTP経路の変更はTASK-93.2以降に限定する。

実装: dlsiteCache.ts に専用bun:sqliteストアを追加。HTMLとメタデータを同一行・同一transactionでgzip BLOB保存し、RJ/VJ正規化、outcome別TTL、期限切れ非返却、Content-Type/サイズ制限、status/cleanupを実装。通常起動ではデータルート配下の dlsite-cache.sqlite を開き、MIMIKAGO_DLSITE_CACHE_DB とTTL・上限の各環境変数を厳格に解釈する。CLIは `pnpm --filter @mimimilli/server dlsite-cache -- <status|cleanup|import ...>`。importは通常 .html のみを受け、symlink/gzip入力を拒否し、parseDlsiteHtmlの結果で outcome を決定する。テスト用HTML（52 bytes）はgzip後68 bytes、圧縮率1.31だった（小さすぎる合成HTMLのため実運用の数百KBページの見積もりには使わない）。focused 7件、pnpm check、pnpm test（server 282件 / client 301件）が通過。Luna検証前のためDoDは未完了。

訂正: 上記の合成HTML計測値は52 bytes→gzip 70 bytes、圧縮率1.35です。小さなHTMLではgzipヘッダーのため膨らむため、実ページ容量の見積もり値ではありません。

レビュー修正: gzip BLOBの読出しはzlib maxOutputLengthで展開中から上限を強制し、改ざんされた過大BLOBを拒否するテストを追加。転送サイズと展開後サイズは validateDlsiteHtmlInput の別フィールドとして検証する契約へ分離し、圧縮HTTP応答を扱うTASK-93.2でも利用できる形にした。importはO_NOFOLLOWで開いた同一fdをfstat/readするため、lstat→readFileのTOCTOUを避ける。cache close/reopen永続性、parse_error本文保持とTTL、safe integer加算もテストした。repo内にDLsite実ページHTML fixtureは存在せず、実HTTPアクセスは行わないためAC #12を未チェックへ戻した。live fetch統合前のため、期限切れキャッシュを返さないことまでは確認できるが「再取得失敗をエラー伝播」の部分はTASK-93.2で確認するためAC #8も未チェックへ戻した。再検証: focused 11件、pnpm check、pnpm test（server 286件 / client 301件）成功。

AC #8の再取得失敗伝播とAC #12の実ページ容量測定は、live HTTP統合を行うTASK-93.2へ移管した。93.1では期限切れエントリを返さないストア契約までを完了範囲とする。

Solレビューおよび既報の検証結果に基づき、残る受け入れ条件とDoDを確認した。focused 11件、pnpm check、pnpm test（server 286件 / client 301件）は成功済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
専用SQLiteのDLsite HTMLキャッシュ、gzip BLOB、outcome別TTL、CLI、入力検証とストア単体テストを完了した。HTTP統合で検証すべき期限切れ後の再取得失敗伝播と実ページfixture測定はTASK-93.2へ移管した。
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 受け入れ条件に対応する実装・テスト・必要なドキュメントを完了している
- [x] #2 pnpm check が通る
- [x] #3 pnpm test が通る
<!-- DOD:END -->
