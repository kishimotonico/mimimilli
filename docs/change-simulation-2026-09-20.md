# 機能追加の変更シミュレーション 2026-09-20

対象はmaster `119aef15fa640b97fcbd5c507ecbd98dde1db411`。コードを読み、想定した要件の変更箇所を追跡しました。機能の実装、テスト実行、変更件数や工数の見積もりは行っていません。以下は機能の採用決定や実装計画ではなく、現在の設計が変更をどう受け止めるかの評価です。

[第1回レビュー](architecture-review-2026-09-20.md)と[仕様・拡張性レビュー](specification-review-2026-09-20.md)を補う資料です。参照行は上記commit基準です。

## A. 個人評価を追加する

### 想定する仕様

作品へ1〜5の個人評価を付け、未評価も許可します。Library詳細とFilesの登録済み作品の操作欄から変更でき、作品一覧にも表示します。評価の高い順に並べられ、スマートフォルダーでは「個人評価がn以上」を指定できます。

ここでは未評価を`null`、評価順は高い順・未評価末尾・同値はWork ID順とします。「未評価だけ」の抽出は別の条件として追加でき、0を未評価の代用品にはしません。

評価の正本はuser DBです。既存の`rating/R18`は年齢区分を表す作品属性で、今回の個人評価とは異なります。`userRating`など区別できる名前を使うのが適切です。作品属性をタグで表すADR-0005を、ブックマークや個人評価までメタファイルへ保存する規則として解釈する必要はありません。

### 自然に必要となる変更

| 層 | 主な根拠 | 変更の意味 |
| --- | --- | --- |
| 共有契約 | `shared/src/work.ts:167`、`shared/src/library.ts:10,70` | 読み取りDTOへ評価を追加し、ソートと評価条件を定義する |
| user DB | `server/src/adapters/real/userSchema.ts:3`、`userWorkStateRepository.ts:31` | nullableな評価列と更新処理を追加する。user migrationの既存方式を使う |
| 検索の読み取り | `workQuerySql.ts:150`、`workQueryRepository.ts:211,369`、`workRowMapping.ts:187`（いずれもreal配下） | ATTACH済みuser状態から評価を読み、一覧・詳細へ合成する |
| 評価順 | `server/src/adapters/real/workQuerySql.ts:22`、`server/src/core/worksQuery.ts:152` | SQLと参照実装へ同じnull順・同値順を定義する |
| 保存済み条件 | `server/src/core/smartFolder.ts:28`、`server/src/adapters/real/workQuerySql.ts:247` | 評価条件を最終評価とSQL候補抽出へ追加する |
| 条件編集UI | `client/src/features/library/model/smartFolderEditor.ts:10,114`、`ui/SmartFolderRuleCard.tsx:108` | 評価用の入力と検証を追加する |
| 表示UI | `client/src/features/library/ui/WorkRow.tsx`、`WorkTile.tsx`、`preview/WorkDetail.tsx` | 一覧表示と詳細での評価操作を追加する |

複数の層が変わるのは、保存・検索・編集・表示を含む機能だからです。この変更地図の広さ自体を欠陥とは評価しません。特にSQLとcoreの比較規則を両方変えることは、実行方式を分け、契約テストで一致を確認する既存設計に沿っています。

catalog/userのATTACH JOINがすでにあるため、評価をcatalogへ複製したり、別の検索基盤を導入したりする必要はありません。catalogの保存スキーマとメタファイル形式を変える必要もありません。

スマートフォルダーの候補抽出は現在`main.works`を基点にしているため、評価条件にはuser状態へのJOINまたは参照が必要です（`workQueryRepository.ts:312`）。これは所有権の異なる値を検索へ加えるための自然な変更です。タグ・長さ・個人評価の三種であれば、判別unionとswitchを拡張する方が、汎用ルールエンジンを新設するより分かりやすいと判断します。

### 現在の構造が余計に広げる変更

一つ目は更新APIです。既存の`WorkPatch`へ評価を追加すると、meta用の`sourceRevision`とメタファイル読取りへ結び付きます。routeは全PATCHにrevisionを要求し、realの`patchWork`はbookmarkだけでもmetaを読みます。

根拠は`shared/src/api.ts:179`、`server/src/routes/works.ts:100`、`server/src/adapters/real/workMethods.ts:156`です。評価変更がmetaの欠損や外部編集の競合に依存する理由はありません。user状態専用コマンドを設け、bookmarkと評価をそこで更新するのが自然です。一つのuser DB内で完結でき、複数正本をまたぐ補償処理は不要です。

二つ目はキャッシュ整合性です。評価の変更は、詳細表示、通常一覧の値、評価順の位置、スマートフォルダーへの所属へ影響します。現在はLibraryの`useLibraryQueries.ts:272`と`workPatchInvalidation.ts:30`が作品PATCH後の更新を、Filesの`FilePreviewWorkActions.tsx:79`が登録・登録解除後の更新を決めています。現状は異なる操作ですが、この構成のまま各画面へ評価mutationを直接追加すると、同じ評価更新の範囲を別々に定義することになります。

共通mutationが詳細・一覧・条件付き一覧の整合性を保つ最低限の方針を持ち、Libraryには表示中一覧へのpatch/resetの最適化を残す構造が適しています。評価専用atomは不要です。サーバー値、詳細query、一覧query、mutationの状態で足りるところへ、新しい同期対象を増やすべきではありません。

三つ目は投影データの型です。`scanRegister.ts:140`はcatalogを作る途中でAPIの`Work`を組み立てるため、bookmark・lastPlayed・resumeまで運んでいます。対応する`scanWorkQueries.ts:5`もuser状態を読みます。`Work`へ必須の評価フィールドを加えると、意味として評価を扱わないスキャンまで型の変更が波及します。

投影入力はcatalogに必要なデータとし、user側は新規Work IDの初期状態だけを作り、APIの読み取りで合成する境界が明快です。これはデータ型の所有権を見直す根拠ですが、評価機能のためにスキャン全体を作り直す必要があるという意味ではありません。

小さいながら不要な二重管理もあります。`navigationUrl.ts:43`付近の`SORTS`は、sharedの`sortIdSchema`と許可値を別に持っています。評価順を追加する際、URL検証の許可集合をsharedへ揃えれば十分です。route状態の全面移行まで抱き合わせる必要はありません。

### Filesとの接続

`FsEntry`はすでに`workId`を持ちます（`shared/src/fs.ts:14`）。登録済み作品ルートまたは単一ファイル作品の操作欄から、そのIDで作品queryと共通mutationを使えます。`FsEntry`へ個人評価を複製する必要はありません。

作品に属する任意の音声・画像ファイルと、作品そのものの操作欄は区別します。既存の`isWorkFolder`、`isSingleFileWork`という判定を利用できます。新しい評価機能のためにFilesのパス状態やplayerの状態を変える必要はありません。

### 評価

この機能は現在の永続化・検索構造に無理なく載ります。明確な障害になるのは技術スタックではなく、meta/userの更新契約と、画面ごとのmutation・キャッシュ方針の分散です。第1回レビューのR1・R2を具体的な追加要件で裏付ける結果になりました。

## B. Filesから既存の作品を編集する

「Filesから編集できる」には、異なる二つの要件があります。区別せずに設計変更の必要性を評価すると、大きすぎる提案になります。

### B1. 作品詳細へ移動して、そこで編集する

Filesの登録済み作品に「作品の詳細を開く」を置き、既存の全画面詳細へ遷移します。その画面で既存の編集ボタンを押す、二段階の操作です。

使えるものはすでにあります。

- `shared/src/fs.ts:14`の`workId`
- `client/src/features/files/ui/FilePreview.tsx:61`付近の登録済み判定
- `client/src/features/files/ui/FilePreviewWorkActions.tsx:134`付近の操作欄
- `client/src/entities/work/model/navigationActions.ts:8`の`openWorkDetailAtom`

自然な変更はFiles側の操作と既存遷移の接続です。作品編集、API、DB、player、CSSの全体設計を変更する必要はありません。既存の機能境界が再利用に役立つ例です。

ただし、これを「Files内で編集できる」「編集を直接開く」と説明するのは不正確です。画面遷移と追加のクリックを許容する要件であることを明示する必要があります。

### B2. Filesを離れず、一クリックで編集ダイアログを開く

現状の`WorkEditDialog`はLibrary feature配下にあり、`WorkDetail`の局所状態で開きます（`client/src/features/library/ui/preview/WorkDetail.tsx:85,200,243`）。作品PATCHもLibraryの画面文脈を受け取るhookへ結び付いています。Filesからそのままimportすることはfeature sibling禁止の境界にも反します。

ここでURLへ`?edit=1`を追加するだけでは、編集機能の所属は解決しません。一度だけ消費する指示、Backで再訪した場合、dirtyな編集からの遷移など、新しい履歴上の意味を定義することになります。ダイアログを開くという要件に、不要なroute状態を持ち込むことになります。

適切な変更は、作品編集をLibraryから共有の編集機能へ切り出すことです。共通のWorkEditorとmutationをLibrary・Filesがそれぞれ局所的にmountする形でも成立します。アプリ全体で編集モーダルを一つにするなら、Work IDを指定して編集を要求し、appの合成点に置くeditor hostが詳細取得、編集内容、未保存確認、保存、必要なキャッシュ更新を所有する案もあります。hostの有無より、共有編集機能がLibraryのnavigationを要求しないことが重要です。汎用コマンドバスは不要です。

| 変更するもの | この要件では変えなくてよいもの |
| --- | --- |
| Filesの編集操作、編集対象のWork ID | Filesの場所・選択のモデル |
| 共通editorと作品編集mutation。必要なら共通host | `/work/:id`のURL契約、履歴の同期方式 |
| Libraryの編集トリガーを共通入口へ接続 | player、音声の所有権 |
| 保存後の必須キャッシュ整合性と画面固有の最適化の接続 | サーバーのmeta編集仕様、catalog/user DBの構成 |

未保存内容の確認、IME処理、フォーカス復帰など既存の編集・ダイアログ動作は維持します。Library専用のnavigation型を共通editorへ渡してしまうと、ファイルを移しただけで責務の分散が残ります。

### 評価

B1なら既存構造の再利用で十分です。B2なら共有する能力の境界を見直す価値があります。両方を同じ「Files編集」という名前で扱わず、必要な体験を先に決めることが、設計を単純に保つ上で効きます。

CSSには歴史的なimport順の課題がありますが、今回の編集機能抽出を妨げる主因ではありません。Files編集のためにCSS全面整理やナビゲーション刷新まで同時に行う提案はしません。

## 二つのシミュレーションから分かったこと

機能追加のためにDBやAPI、UIへ手を入れることと、無関係な状態や規則まで変更することは区別できます。

今回、前者に当たるのは評価列、読み取りDTO、比較規則、入力部品の追加です。後者は、個人評価のためのmeta CAS、API用Workの拡張が投影入力へ波及すること、Filesの編集開始のためにLibraryのnavigationを渡すことです。

先に整える価値が高いのは、正本別の更新コマンドと画面から独立した作品編集の入口です。一方、汎用ルールエンジン、イベントバス、全画面のroute刷新、評価のcatalog複製は、どちらの要件からも必要性を確認できませんでした。
