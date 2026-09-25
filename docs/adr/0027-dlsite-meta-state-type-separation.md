# ADR-0027: DLsite meta専用型とAPI合成型を分離する

- ステータス: 承認
- 日付: 2026-09-24
- 関連: [ADR-0017](0017-meta-source-projection-and-work-identity.md)（DLsite `status` の正本と投影）、backlog TASK-468

## 文脈

ADR-0017 は `mimimilli.json` へ永続化するDLsite連携状態（`rjCode`・連携分類・`appliedTags`）と、DLsite取得キャッシュと合成してcatalog・APIへ返す状態（`not_found`/`error`を含む5値の`status`、`lastAttemptAt`、`error`、`errorKind`）を文章として区別していた。しかしコードの型はこの区別を反映していなかった。

`metaFileSchema`（`shared/src/meta.ts`）の`dlsite`フィールドは、API向けの`dlsiteStateSchema`（5値の`status`、`lastAttemptAt`、`error`、`errorKind`を含む）をそのまま使っていた。`mimimilli.json`に`status: "not_found"`や`status: "error"`が書き込まれていても、型としては正当な値として受理された。

書込み側は`toMetaDlsiteState`という変換関数で、同じ型を返しつつ`status`を3値（`none`/`applied`/`skipped`）へ読み替え、`lastAttemptAt`/`error`/`errorKind`を`null`にする規約で正本を守っていた。読取り側の投影（`projectDlsiteState`）も`metaLinkageStatus`という関数で同じ読み替えを行い、`not_found`/`error`が正本に残っていた場合は`none`として扱っていた。

この状態では、どの値が正本として有効かは型ではなく変換関数の呼び出し規約に依存する。呼び出しを一箇所でも省略すると、取得失敗の一時情報が正本へ漏れる、または旧い一時状態を無警告で`none`へ読み替えてしまう。後者は実際に`WorkEditSnapshot`（`GET /works/:id/source`の応答型）でも起きていた。`WorkEditSnapshot.dlsite`は`dlsiteStateSchema`型だったが、実際の値は常に`toEditSnapshot`が`source.meta.dlsite`をそのまま詰めたものであり、`status`が`not_found`/`error`になることは実装上あり得なかった。クライアント側の`DlsiteEditor`はこの本来出ない値（`not_found`/`error`）を判定する分岐と`.error`表示を持っており、型が実際より広いことがデッドコードを生んでいた。

## 決定

### 型の分離

`shared/src/dlsite.ts`に、正本が持てる連携分類だけの型を新設する。

- `dlsiteLinkageStatusSchema` / `DlsiteLinkageStatus`: `"none" | "applied" | "skipped"`の3値。
- `metaDlsiteStateSchema` / `MetaDlsiteState`: `{ rjCode: string | null; status: DlsiteLinkageStatus; appliedTags: NormalizedTag[] }`。`lastAttemptAt`・`error`・`errorKind`は型として存在しない。
- `emptyMetaDlsiteState()`: `MetaDlsiteState`の空値ファクトリ。
- `toDlsiteLinkageStatus(status: DlsiteStatus): DlsiteLinkageStatus`: 合成済みAPI状態から連携分類だけを取り出す（`not_found`/`error`は`none`に丸める）。real/fixture両アダプタが、合成済み値から正本相当の値を作るときに使う。

既存の`dlsiteStateSchema` / `DlsiteState` / `emptyDlsiteState()`は変更しない。catalogが持つ取得失敗・試行時刻を含む合成済み状態（`work.dlsite`、`WorkSummary.dlsite`、`catalogWorkRepository.setDlsiteState`等）は引き続きこの型を使う。

`shared/src/meta.ts`の`metaFileSchema.dlsite`と、`shared/src/api.ts`の`workEditSnapshotSchema.dlsite`（`GET /works/:id/source`の応答型）を`metaDlsiteStateSchema`に変更する。これにより「meta正本に書ける値」と「APIが返す合成済みの値」が別の型になり、`WorkEditSnapshot`が実際に返す値の範囲と型が一致する。

### 変換関数を型に置き換える

`toMetaDlsiteState`と`metaLinkageStatus`（元`server/src/adapters/real/dlsiteProjection.ts`）を廃止する。書込み側の呼び出し元（`dlsiteApply.ts`、`workRegister.ts`）は、最初から`MetaDlsiteState`のリテラルを直接組み立てる。`applyDlsiteStatePatch`（`shared/src/dlsite.ts`）は`MetaDlsiteState`を受け取り`MetaDlsiteState`を返すよう変更し、`lastAttemptAt`/`error`/`errorKind`を「持っていないので触らない」形にする。

meta linkageとDLsite取得キャッシュの解決結果を合成する`projectDlsiteState`（と入力型`DlsiteCacheResolution`）は、`server/src/adapters/real/dlsiteProjection.ts`から`shared/src/dlsite.ts`へ移す。real（`DlsiteCache`が返す`DlsiteCacheResolution`）とfixture（seedから逆算した`DlsiteCacheResolution`相当）の両方がこの同一関数を呼ぶ。real/fixture間の直接importはlayer境界チェック（`scripts/layer-boundary-rules.mjs`）で禁止されているため、合成ロジックを重複実装せずに両adapterで一致させるには、pure functionとして両者が依存できるsharedへ置くのが筋が良い。`projectDlsiteState`は`metaDlsite: MetaDlsiteState`を受け取り、`metaDlsite.status`を直接分岐に使う（3値であることが型で保証されるため、読み替え関数が不要になる）。

### 非対応値は診断対象にする（丸めない）

`mimimilli.json`の`dlsite.status`に`not_found`/`error`のような取得失敗の一時値が残っていた場合、投影時に`none`へ読み替える（ADR-0017の従来方針）のではなく、通常のスキーマ検証エラーとして扱う。新しい汎用機構は作らない。既存の`MetaParseError`（`server/src/adapters/real/meta.ts`）／`InvalidMetaFile`（`shared/src/scan.ts`）の仕組みにそのまま乗せる。`metaFileSchema.safeParse`が`dlsite.status`の非対応値で失敗すると、他のスキーマ違反と同じ経路でscanの`invalidMetaFiles`に集計され、Filesとscan結果に診断として表示される。該当作品のcatalog投影は更新されず、直前の投影が残る。

未知の外部ツール用フィールドを保持する既存方針とは矛盾しない。対象は「型が知っている`status`フィールドに、型が許さない値が入っている」場合であり、型が知らないフィールド（`raw`の他のキー）はこれまでどおり`patchMetaFileCas`の生JSON編集で保持される。

### 既存mimimilli.jsonの手動移行

この決定の実装後、`dlsite.status`が`not_found`または`error`のまま残っている`mimimilli.json`は、通常のscan・watcher・編集APIで読み取れなくなり（`MetaParseError`→`invalidMetaFiles`診断）、該当作品のcatalog投影は更新されなくなる。自動移行は行わない。必要な場合はユーザーが以下を実行し、該当フィールドを`none`へ正規化する。

Linux/macOS（bash）:

```bash
library_root=<ライブラリルート>
find "$library_root" \( -name 'mimimilli.json' -o -name '*.mimimilli.json' \) -print0 |
while IFS= read -r -d '' meta; do
  temporary=$(mktemp "${meta}.dlsite-status-migration.XXXXXX")
  if jq 'if .dlsite.status == "not_found" or .dlsite.status == "error"
         then .dlsite.status = "none" | .dlsite.appliedTags = (.dlsite.appliedTags // [])
         else . end
         | .dlsite |= del(.lastAttemptAt, .error, .errorKind)' \
    "$meta" > "$temporary" && mv "$temporary" "$meta"; then
    continue
  fi
  rm -f "$temporary"
  exit 1
done
```

Windows（**PowerShell 7以降（`pwsh`）専用**。Windows PowerShell 5.1は既定の出力エンコーディングが異なり、`jq`のUTF-8出力の読み取り・書き込み双方で日本語を含む`mimimilli.json`を壊す恐れがあるため対象外。`jq`がPATHにあること）:

```powershell
# jqの標準出力（UTF-8）をシステムのコードページ等で誤って解釈しないよう、読み取り側の
# エンコーディングを明示する。pwsh 7でも既定値は環境（chcp・ロケール）に依存するため省略しない。
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$libraryRoot = "<ライブラリルート>"
$filter = 'if .dlsite.status == "not_found" or .dlsite.status == "error"' +
  ' then .dlsite.status = "none" | .dlsite.appliedTags = (.dlsite.appliedTags // [])' +
  ' else . end' +
  ' | .dlsite |= del(.lastAttemptAt, .error, .errorKind)'

Get-ChildItem -Path $libraryRoot -Recurse -File |
  Where-Object { $_.Name -eq "mimimilli.json" -or $_.Name -like "*.mimimilli.json" } |
  ForEach-Object {
    $meta = $_.FullName
    $json = (& jq $filter $meta) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "jqの実行に失敗しました: $meta" }
    $temporary = "$meta.dlsite-status-migration.tmp"
    # BOM付きUTF-8はmimimilli.jsonの読み取り（JSON.parse）が拒否するため、
    # 明示的にBOMなしUTF8Encodingで書く（Set-Content -Encoding utf8既定のBOM付与を避ける）。
    [System.IO.File]::WriteAllText($temporary, $json + "`n", $utf8NoBom)
    Move-Item -Force $temporary $meta
  }
```

`mimimilli.json`の読取り（`readMetaSource`/`readMetaFile`）は`Buffer.toString("utf-8")`してから`JSON.parse`するため、先頭にBOM（`U+FEFF`）があると`Unexpected token`でJSONパースエラーになり、`MetaParseError`（`invalidMetaFiles`診断）扱いになることを確認済み。BOMを出さない書き方は移行後にファイルを壊さないための必須条件であり、単なる見た目の問題ではない。

移行後はフルスキャンまたは`POST /api/scan`でcatalogを再投影する。ADR-0017が既に持っていた移行例（`lastAttemptAt`/`error`/`errorKind`をnullにして`status`を`none`へ寄せるもの）は、今回`status`が非対応値のときにスキーマ検証そのものが失敗するようになったため、このADRの例で置き換える。

### ADR-0017との整合

ADR-0017「DLsite `status` の正本と投影」の表と、「既存の`mimimilli.json`に`not_found`/`error`が残っている場合は、投影時に連携分類`none`として扱いcacheから再合成する」という記述は、本ADRの決定によって現在の実装と合わなくなった。該当箇所はこのADRで上書きし、ADR-0017本文の当該段落は本ADRを参照する形に書き換える。

## 帰結

- `MetaFile["dlsite"]`と`WorkEditSnapshot["dlsite"]`は`MetaDlsiteState`になり、`not_found`/`error`・`lastAttemptAt`・`error`・`errorKind`を型として持てない。`DlsiteEditor`（client）が持っていた、実際には出ない`not_found`/`error`表示分岐は削除する。
- `applyDlsiteStatePatch`は`MetaDlsiteState`だけを対象にする。fixtureアダプタもrealと同じ「正本／cacheの分離」構造にする。`FixtureState`は`works`（DLsite合成状態を持たない作品レコード）、`dlsiteLinkages`（workId→`MetaDlsiteState`、realのmeta linkageに対応）、`dlsiteFetchFailures`（rjCode→`DlsiteCacheResolution`、realの`DlsiteCache`に対応）の3つだけをDLsiteの正本として持つ。API向けの合成状態（`WorkSummary.dlsite`）はどこにも保存せず、`composeWork`/`composeWorks`が読み出しのたびに`projectDlsiteState(linkage, cacheの解決結果)`で組み立てる。シード（`data.ts`・`bulkData.ts`・`scenarios.ts`）も、合成済みDlsiteStateから取得失敗を逆算するのではなく、`SEED_DLSITE_LINKAGES`・`SEED_DLSITE_FAILURES`として最初から作品ごとのlinkageとrjCodeごとの取得キャッシュを別に書く。`updateDlsiteState`は現在のlinkageを`applyDlsiteStatePatch`でパッチし、`dlsiteLinkages`へ書き戻すだけで、合成は次の読み出し時に`composeWork`が行う。これによりrealと同じ意味論になる: 同じRJコードを再送信しただけならキャッシュの取得失敗表示（`not_found`/`error`）は保持され、RJコードを変更すれば新しいコードのキャッシュ（miss）に切り替わりnoneへ戻り、skip切替はキャッシュより優先されてtransientフィールドがnullになる。real・fixture双方をこの3操作で通す契約テスト（`server/tests/dlsiteUpdateStateProjectionContract.test.ts`）で固定する。一覧・詳細・DLsite通知・facet・`dlsiteFetch`・`dlsiteApply`・`runDlsiteBulk`など`work.dlsite`を読む全経路も、同じ`composeWork`／`dlsiteLinkageOf`へ揃える。
- 既存の`mimimilli.json`に`status: not_found`/`error`が残っている場合、次回scanから読み取れなくなり、該当作品はscan結果・Filesの診断に現れる。ユーザーが上記の移行コマンドを実行するまで、その作品のcatalog投影は更新されない（正本は保持されたままなので、データは失われない）。
- `toMetaDlsiteState`・`metaLinkageStatus`という変換関数は廃止する。「meta正本に何を書いてよいか」は型で保証され、変換関数の呼び出し漏れという失敗様式が構造的になくなる。
