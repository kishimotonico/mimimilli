# データの寿命と作品identityのレビュー 2026-09-21

対象: master `119aef15fa640b97fcbd5c507ecbd98dde1db411`。[レビューTODO](review-todo-2026-09-20.md)のRV-02・RV-03を扱います。静的調査であり、DBの再作成・復元・実データ操作はしていません。

## 再構築で保持するもの、失ってよいもの

catalogとuser DBの分離は、コードの書込み・読取りまで機能しています。catalog再構築で追加日・bookmark・履歴が初期化される、という欠陥は確認されませんでした。ただし「再構築可能」は、現在読める正本からの再投影を意味します。過去の観測や、現在存在しない作品の最後の表示まで再現する保証ではありません。

| 項目 | 正本・再生成元 | 寿命と判断 |
| --- | --- | --- |
| Work ID・タイトル・タグ・playlist定義 | meta | 同じIDの再発見で再接続する。明示解除後の新規登録は別ID |
| 追加日・bookmark・最終再生・resume | user DB | scanで既存値を上書きしない。明示解除で削除 |
| root設定 | user DBの絶対パス | 端末ローカル設定。別環境では再設定が必要 |
| smart folder・タグprefix定義 | user DB | catalogや個別作品と独立して保持 |
| 候補の除外指定 | user DBのroot相対path | 現行はrootを識別せず保持。後述の判断が必要 |
| identity conflict診断 | 現在のmeta配置 | scanで置換。過去の診断の保持は不要 |
| missing・不正metaの以前の表示 | 既存catalogの最後の投影 | catalog再構築で失われ得る。user状態とは別 |
| scan結果・最終scan時刻 | 走査時の観測 | 結果は一時状態、最終時刻等はcatalog。再観測できる |
| probe・合計尺 | 音声ファイルとplaylist定義 | 再計測できる派生値 |
| DLsite適用・除外・product code | meta | 正本から再投影できる |
| DLsite取得HTML・取得失敗・画像cache | 独立cache DB | 正本ではない。失うことを許容する範囲と表示上の意味を揃える |

根拠: `server/src/adapters/real/userSchema.ts:3`、`userWorkStateRepository.ts:31`、`catalogSchema.ts:118`、`scanFinalize.ts:14`、`dlsiteProjection.ts:59`。短いファイル名は同じディレクトリー配下です。

## 5つの再構築・移動シナリオ

| シナリオ | 現行の成立する保証 | 保証しないこと |
| --- | --- | --- |
| catalogだけを再作成しscan | 現存metaを投影し、Work IDで既存user行へJOIN | missing中の作品の過去タイトル等を再現すること |
| missing後に同じIDで再発見 | user行を保持し、元の追加日・bookmark・履歴へ再接続 | 別IDや似たパスを同じ作品と推測すること |
| 明示解除後に同じ音声を再登録 | 新meta・新UUIDで登録 | 削除した履歴を引き継ぐこと |
| rootを変えて以前のrootへ戻る | 同じmeta IDなら保持中のuser状態へ再接続 | rootごとの独立した設定一式を保持すること |
| metaだけ移送／user DBも復元 | metaだけなら作品定義、userもあれば対応する利用者状態を復元 | metaだけで追加日・履歴を戻すこと、旧絶対パスを新環境へ自動対応させること |

再構築時、scanは仮の初期値をWorkへ組み立てますが、user行へのINSERTは `onConflictDoNothing` です。公開後の読取りはuser側の値をJOINします。仮の `addedAt = now` があるという理由だけで、既存の追加日が失われるとは言えません。

根拠: `server/src/adapters/real/scanRegister.ts:140`、`scanUpsertBatch.ts:94`、`userWorkStateRepository.ts:31`、`workQuerySql.ts:150`。

userだけに残る行は、同じUUIDの再発見を待つ正常な状態です。逆にcatalog作品にuser行がない状態は起動時にfail-fastします（`server/src/adapters/real/db.ts:202`）。この非対称性は意図的で、DB間cascadeや初期値の自動補完を足す必要はありません。

resumeも、参照先が解決しなければ保存行を消さず、API上でnullにする処理があります（`workQuerySql.ts:137`、`workRowMapping.ts:348`）。catalog再構築とuserの破棄を結び付けない設計として維持できます。

missing作品が再構築後の一覧から消える点は、ADR-0008で既に明示されています。これは新しい欠陥として数えません。完全な過去一覧を復元したい要件が出ない限り、最後のcatalog全体を耐久履歴へ昇格させる必要もありません。

## 見直すべき寿命の境界

### L1. 候補除外の意図にrootのスコープがない

`scan_candidate_exclusions` はroot相対pathだけを主キーに持ち、root変更でも行を保持します。現在の候補セッションにはroot fingerprintの検証がありますが、永続化された除外指定にはrootがありません。root Aの `circle/work` を除外すると、無関係なroot Bの同じ相対pathにもその意図が適用される構造です。

根拠: `server/src/adapters/real/userSchema.ts:40`、`userWorkStateRepository.ts:218`、`scanCandidateSession.ts:26`、`scanner.ts:349`。

ここは前回S1のroot再設定契約と一緒に判断します。単一の稼働ライブラリを別のrootへ置き換える仕様なら、除外を再設定時に消去する案が最小です。rootを行き来して除外を戻したいならrootごとに保持します。絶対パスをキーにする場合でも、同じライブラリの場所変更を自動認識できるとは約束しません。

root設定を変えるたびに利用者の意図を黙って消すことも望ましくありません。消去を選ぶ場合は、再設定で保持するuser状態と破棄するroot依存状態を事前に示します。複数ライブラリ管理基盤を追加することが唯一の解決策ではありません。

### L2. 「最後のDLsite失敗」とcacheの有効期限は違う寿命

通常運用のcatalogは最後の失敗を保持できます。一方、再構築時の `DlsiteCache.resolve` は有効期限を判定し、期限切れの失敗は投影材料として返しません。有効な別snapshotもなければmissとなり、投影は `none` になります。

根拠: `server/src/adapters/real/dlsiteCache.ts:357`、`dlsiteProjection.ts:59`、ADR-0017のDLsite状態の節。

したがって「最後の失敗表示」は、常にmetaとcacheから同じ値へ戻せる投影ではありません。簡単な仕様は、一時観測なのでcatalog再構築時に失ってよいと明記することです。失敗表示を保持したいなら、再取得を抑制するTTLと、最後の結果を読む契約を分け、cleanupでいつ失うかも定義します。取得履歴全体の保存は必要ありません。

DLsite導線の見直し担当へ渡すのはこの寿命の制約だけです。一括取得や通知UIの再設計は、このレビューから並行着手しません。

### L3. user復元とcatalogの組み合わせを復旧手順に含める

古いuser DBだけを新しいcatalogへ戻すと、catalogにある作品のuser行がなくなり、起動時検査で停止する場合があります。検査は安全側の妥当な処理です。一方、ADR-0023のuser単独リストア手順だけでは、この後に必要なcatalogとの整合の取り方が読み取れません。

根拠: `server/src/adapters/real/db.ts:202`、`docs/adr/0023-in-place-migration-simplification.md:47`。

復旧契約には、サーバー停止・復旧前データの退避に加え、復元したuserと整合するcatalogを使うか、catalogを別途再構築してscanする判断を含めます。catalog再構築ではmissingの過去表示が戻らない点も伝えます。user側へ不足行を現在時刻で自動補完する案は採りません。

これは復旧手順の設計上の補足であり、今この環境のDBを作り直す指示ではありません。自動リストア・自動移行・全DBの分散トランザクションを追加する必要はありません。

## 作品の所有範囲とidentity

### 配置の所属と、音声の参照を区別する

現行Workは、物理配置とmetaの再生参照集合の両方を持ちます。Filesは最深の祖先作品を所属先として表示しますが、それだけで音声ファイルの排他的所有権が保証されるわけではありません。同じ音声を複数track・playlistから参照でき、catalogにもfileの一意制約はありません。

根拠: `server/src/adapters/real/fsBrowse.ts:35`、`shared/src/work.ts:55`・`:260`、`server/src/adapters/real/catalogWorkRepository.ts:172`。

配信はmetaに列挙されたtrack fileかを確認し、作品のmedia root内に解決できるパスだけを扱います（`server/src/adapters/real/coverMediaMethods.ts:97`）。単一ファイル作品のphysicalPathはsidecarのdefault playlist先頭trackから導かれ、media rootはその親ディレクトリーです（`scanRegister.ts:39`、`shared/src/meta.ts:95`）。したがって「Work ID＝フォルダーパス」でも「Work＝必ず一音声」でもありません。

推奨は、Workを安定IDのある正本と、その正本が指定する再生参照集合として定義し、配置と参照解決の境界を別に明示することです。Filesの所属表示をidentityの根拠にしません。Work内の同一音声の複数参照は維持し、media root外への推測追従はしません。

異なるWork間でも音声を必ず排他的に所有させたいなら、それは追加の製品制約です。祖先／子孫のmetaと手動の参照を含めて一貫した検証が必要になります。現行のFiles所属表示から、その排他性が実装済みと推論してはいけません。今回、ファイル単位の所有権レジストリーを追加すべき根拠まではありません。

### 操作とidentityの対応

| 操作 | 現行または既定のidentity | user状態の扱い |
| --- | --- | --- |
| 同じmetaを移動・rename | Work IDを維持しlocationを更新 | 同じIDへ再接続 |
| 同じWork IDのmetaを複製 | routine scanでは競合診断。自動でどちらかを採用しない | 元の状態を複製先へ推測コピーしない |
| 競合した複製を明示的に別作品へ | Work IDだけを新しくする | 新Workとして開始。Playlist・Track IDはlocalなので維持可能 |
| 明示解除後の新規登録 | 新Work ID | 旧user状態は解除で削除済み |
| 孤立metaの再投影 | 原則同じWork ID | 保存されていれば再接続。ただし現行は衝突時に自動再採番する経路がある |
| 親登録と子の解除 | 親は新規作成か既存meta復元かで異なる | 子の履歴を親へ移送しない。子解除はuser状態も削除 |
| Trackの順番・名前・区間を変更 | 既存ADRではIDを維持 | 区間相対offsetが有効なら継続。範囲外・未解決は適用しない |
| 同じIDのまま別内容の音声に差替え | メディアの意味の判断は編集操作に委ねる | アプリが同じ内容かを自動推測して引き継がない |

根拠: ADR-0017のidentity節、ADR-0008のID・resume v2節、`server/src/adapters/real/workMethods.ts:107`、`scanner.ts:547`、`workRegister.ts:318`・`:363`・`:385`。

親登録のmergeは候補の表示重複を取り除くだけの操作ではなく、子meta・catalog・user状態を削除する操作です。親は必ず新IDになるわけではなく、既存metaを復元すればIDを維持できる場合があります。S4で提案したように、通常登録では子作品があれば拒否し、統合を残すなら別の明示操作とする方が、成立した効果を説明しやすくなります。自動の履歴合成は推奨しません。

孤立meta復元は、別pathとのID衝突時にWork・Playlist・Trackを全て再採番します（`scanner.ts:571`、`meta.ts:298`）。一方、明示的なidentity conflict解決はWork IDだけを変えます。この差はR5・S4と関連する既存の問題であり、新規の別課題として重複計上しません。再投影では勝手にidentityを変えず、明示的な別作品化ではADR-0017どおりWork IDだけを変える契約に揃える案を推奨します。

### resumeに新しい自動追従を足さない

区間変更とresumeの関係は完全な未定義ではありません。ADR-0008は、区間変更でTrack IDを維持し、offsetをTrack先頭からの相対秒として扱うと定めています。変更後の区間内なら同じ相対位置として継続し、同じ音声の絶対時刻を保証しません。この仕様を維持する限り、区間変更のたびに新IDや履歴消去を要求する必要はありません。

別の内容への音声差替えについては、単なるrenameと同じ意味ではないことを編集操作側で決めます。同じTrack IDのまま外部で内容を差し替えた場合、アプリにはその意図を確実に判定できません。別内容は新Track IDにするという利用契約か、明示的に再生位置をリセットする操作で扱い、音声ハッシュや類似パスでの自動復旧は追加しません。

## 評価の範囲

現行のuser状態保持、JOIN、起動時整合性検査は維持すべき設計です。今回の見直し候補は、root依存の利用者意図、最後の観測結果、復旧時のDBの組み合わせです。耐久データと再計算値を分ける大枠の撤回は推奨しません。

データ寿命はSol(medium)、所有範囲・identityはLuna(max)が調査し、統括が統合しました。L1〜L3には別のSol(medium)による反証確認を行いました。identityについては、親mergeで必ず新IDになる、区間変更のresumeが未定義、とする初期見解を既存コード・ADRに照らして撤回し、上記の限定した結論にしています。
