# ADR-0017: sidecar正本・投影・作品identityを分離する

- ステータス: 承認
- 日付: 2026-08-12
- 関連: [ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)、[ADR-0010](0010-meta-file-rename-mimimilli-json.md)、[アプリケーション設計レビュー 2026-08-12](../application-architecture-review-2026-08-12.md)、backlog TASK-311〜320

## 文脈

`mimimilli.json`とcatalog SQLiteが同じ作品情報を持ち、現在の編集はcatalogを更新してからsidecarへ書き戻している。SQLite transactionはファイル書込みを戻せないため、この順序ではcatalogだけが更新された状態を作り得る。現在のfingerprintも、正規化済みメタ、デフォルトPlaylistのmedia、作品パスを一つに混ぜており、外部編集との競合検知、投影の更新要否、移動検知を分けられない。

また、routine scanは重複したWork IDをパス順で選び、後続sidecarのWork、Playlist、Track IDを自動再採番する。コピー先の検出順によって元作品のidentityを失わせるため、外部で管理される正本をscanが変更する方針は適さない。

2026-08-12時点でcatalog/userの物理2DB構成は維持する。ADR-0008が単一DBを却下した理由、すなわちcatalogの再構築やmigration失敗がuserの耐久データへ到達し得ることは、現在も解消していない。

## 決定

### 正本と書込み順序

物理ファイルと`mimimilli.json`を作品メタデータの正本とする。`catalog.sqlite`は検索、一覧、診断のために再構築できる投影であり、`user.sqlite`はresume、履歴、bookmark、設定など物理ファイルから復元できない状態の正本である。catalog/userの2DBを統合しない。

アプリと外部編集は、いずれも次の経路だけを通る。

```text
外部編集 ─┐
          ├─ mimimilli.jsonを確定 ─ catalogへ再投影
アプリ編集 ┘
```

アプリの作品編集はsource-firstにする。

1. 取得APIはsidecarのexact bytesから得た`sourceRevision`を返す。
2. 更新APIは`sourceRevision`を必須とし、現在のsidecarと一致しなければHTTP 409 `source_changed`を返す。
3. 読み込んだJSON objectへ対象フィールドだけをpatchする。schemaが知らないフィールド、キー順、対象外の値を捨てない。
4. 同じディレクトリの一意な一時ファイルへ書き、ファイルをfsyncしてからatomic replaceする。replace前にもsidecarのbytesを再確認し、変化していれば上書きしない。
5. 確定したbytesを入力に、そのWorkだけをcatalogへ再投影する。catalog更新は短いSQLite transactionで作品投影、関係、診断を置き換える。

catalog更新が失敗してもsidecarは正しい状態として残す。watcherまたは次回scanが再投影して収束させる。catalogを先に更新する経路、またはcatalogの値からsidecarを組み立てる経路は廃止する。

catalogでは検索に必要な正規化表を投影する。PlaylistとTrackは関係表から組み立て、`works.playlists_json`の二重投影は廃止する。DLsiteのHTTP状態、取得失敗、最終試行時刻などの一時状態もsidecar正本へは保存せず、削除可能なcacheへ置く。

scanはsidecarのないフォルダーを自動登録しない。未登録候補を提示し、ユーザーが登録を実行したときにだけsidecar生成、catalog投影、DLsite取得ジョブのenqueueを行う。取得結果はcacheに留め、sidecarへの適用はpreviewを経た明示承認とこの節のsource-first経路を通す。登録済み作品のDLsite取得は維持する。候補提示と登録実行はTASK-318、確認UIはTASK-319、適用内容はTASK-320で実装する。

### revisionとlocation

変更検知は次の3種類に分ける。これらは同じhashへ戻さない。

| 名前                  | 入力                                                            | 用途                                   |
| --------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `source_revision`     | sidecarのexact bytes                                            | 外部編集検知と更新APIのCAS             |
| `projection_revision` | `formatVersion`、parser version、投影に使った検証済みフィールド | parser・投影ロジック変更時の再投影判断 |
| `media_revision`      | 全Playlistが参照する音声とcoverの相対パス、存在、size、mtime    | mediaの変更検知、probe・表示の更新判断 |

作品フォルダーの絶対パスは`location`という独立した観測値であり、revisionには含めない。watcherはscanを早めるヒントであり、最終的な整合はperiodic/full scanが取る。

### Work identity、移動、複製

sidecarのWork UUIDを作品identityとする。Playlist IDとTrack IDはWork配下のローカルidentityであり、catalogのキーは`(work_id, playlist_id)`と`(work_id, playlist_id, track_id)`にする。異なるWork間でPlaylist IDまたはTrack IDが同じでも衝突ではない。これにより、複製時のidentity問題はWork IDだけに閉じる。

この方針は、ADR-0008のWork、Playlist、Track IDをライブラリ全体で一意とする決定を、Playlist/Trackについて上書きする。ADR-0008のスキャン時自動重複修復はWork IDの重複について本ADRが置き換える。同一Work内のPlaylist/Track ID重複は不正sidecarとしてスキーマ検証で弾き、scanとFilesで診断表示する。sidecarを自動修復しない。

scanとFilesは次の状態を区別する。

- 作品フォルダーを丸ごと移動した場合は、同じWork IDの`location`を更新する。
- root外へ一時的に移動した場合はcatalogでmissingにするが、user状態は保持する。
- 同じWork IDが1か所だけで再発見された場合は、同じ作品としてcatalogとuser状態を再接続する。
- sidecarだけを複製して同じWork IDが複数箇所で見つかった場合、routine scanはsidecarを書き換えず`identity_conflict`として診断・表示する。
- `identity_conflict`の全pathはroot相対・separator正規化済みの`WorkspacePath`として診断へ保持する。既存catalog投影があるWork IDは、そのlocationと投影を更新せず保持し、新しく見つかった競合pathは作品としてupsertしない。既存投影がない場合は、いずれのpathも通常作品として公開しない。path順でcatalogの所有者を選ばない。
- 複製側を「別作品として取り込む」とユーザーが明示した場合だけ、そのsidecarのWork IDを再採番する。Playlist/Track IDはWork配下のlocal identityなので維持する。
- 音声だけを移動してsidecarの相対パスが古くなった場合は、パスや内容から推測して追従しない。`broken reference`として表示する。

これにより、ADR-0008の「スキャン時の重複ID修復」にあるWork IDの自動再採番とパス順による所有者決定を廃止する。Work IDの重複が解消されるまで、対象sidecarは正本のまま保持する。

### sidecar format

`mimimilli.json`に整数の`formatVersion`を必須で持たせる。parser versionはアプリ実装の世代、`formatVersion`は外部編集できるデータ形式の世代であり、別に管理する。

対応しない`formatVersion`は読み取り互換層で推測しない。catalogへ投影せず、Filesとscanで診断として表示する。形式変換は明示的なmigration commandだけで行い、通常scan、watcher、編集APIは旧形式を自動変換しない。

### 既存sidecarの手動移行

この決定の実装後、`formatVersion`がない既存sidecarは通常scanで補完しない。移行前にライブラリ全体を退避し、次の例のようにユーザーが明示してv1を付与する。`jq`の更新は未知フィールドを保持し、既に`formatVersion`があるファイルを変更しない。

```bash
library_root=<ライブラリルート>
cp -a "$library_root" "${library_root}.before-format-v1"

rg --files -0 "$library_root" -g 'mimimilli.json' -g '*.mimimilli.json' | while IFS= read -r -d '' meta; do
  temporary=$(mktemp "${meta}.format-v1.XXXXXX")
  if jq 'if has("formatVersion") then . else . + { formatVersion: 1 } end' "$meta" > "$temporary" && mv "$temporary" "$meta"; then
    continue
  fi
  rm -f "$temporary"
  exit 1
done
```

移行後はcatalogだけを再構築してよい。`user.sqlite`は削除・再作成しない。catalogの再構築方法は配布時に提供する明示コマンドに従い、その後にfull scanを実行して、`identity_conflict`、不正sidecar、broken referenceがないことを確認する。source形式の自動移行、旧形式の読取りフォールバック、互換レイヤーは追加しない。

### catalog migration 0012後の再スキャン

`server/drizzle/catalog/0012_scan_revisions.sql` で `works.source_revision` 等が追加される。既存のcatalog行は、次のスキャンが各sidecarを再投影するまで `source_revision` が未設定のまま残る。起動時の自動フルスキャンはない。この間、作品のタイトル・タグ・ブックマークなどsidecarへの書き戻しを伴う編集はできない。

解消手順:

1. アプリ画面上部の「スキャン」を開き、「フルスキャン」を実行する
2. または API から `POST /api/scan` を呼ぶ（例: `curl -X POST http://127.0.0.1:1355/api/scan`）

スキャン完了後、各作品の `source_revision` がsidecarのexact bytesから埋まり、編集操作が使えるようになる。

## 帰結

- sidecar書込みとcatalog投影が別々に失敗し得ることを受け入れる。正本が残るため、catalogは再投影で回復できる。
- 更新UIは`source_changed`を競合として表示し、ユーザーが再読込みして変更を選び直す必要がある。
- 未知フィールドを保持するため、アプリが未対応の外部ツール情報を編集時に失わない。
- `source_revision`、`projection_revision`、`media_revision`、locationの導入は既存fingerprintとその増分スキャン経路を置き換える。実装順はTASK-311、TASK-314に従う。
- `identity_conflict`の診断と明示再採番はTASK-313、TASK-317で実装する。scanの自動登録を候補提示と承認へ置き換えるTASK-318、TASK-319は、この診断を確認面に含める。
- `playlists_json`の削除と関係表からの組み立てはTASK-312で実装する。
