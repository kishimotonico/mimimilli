# ADR-0032: 作品の配置形式をmetaPathから解決し、後段で再推測しない

- ステータス: 承認
- 日付: 2026-09-25
- 関連: [ADR-0010](0010-meta-file-rename-mimimilli-json.md)（メタファイル名）、[ADR-0017](0017-meta-source-projection-and-work-identity.md)（正本と投影）、[ADR-0027](0027-dlsite-meta-state-type-separation.md)（移行コマンドの書式）、[ADR-0029](0029-root-reconfiguration-workflow.md)（catalogの作り直し）、backlog TASK-467

## 文脈

作品の配置形式は2つある。フォルダー形式は作品フォルダー直下の `mimimilli.json`、単一ファイル形式は音声ファイルと同じ階層の `<stem>.mimimilli.json` をメタファイルにする。catalogの `works` は `physical_path`（フォルダー形式ではフォルダー、単一ファイル形式では音声ファイル）と `meta_path` を持ち、形式そのものは保存していない。

後段の処理は、形式を `physical_path` の末尾の拡張子から推測していた。`isAudioWorkPath` が拡張子だけで単一ファイル形式かを判定し、`workMediaRoot` がその結果でトラックやカバーを解決する基準ディレクトリを切り替える。この推測が、再生時間の取得、カバー配信、DLsite画像の保存、登録解除に広がっていた。対応拡張子を変えると既存作品の解釈まで変わり、`foo.mp3` という名前のフォルダーは単一ファイル作品と誤認される。

形式は登録とscanの時点ですでに確定している。登録は実体を `stat` してフォルダーか音声ファイルかを決め、それに応じたメタファイル名で書く。scanはメタファイル名で形式を読み分けている。確定した事実を後段が捨てて推測し直している点が問題だった。

また、単一ファイル形式のメタは中身とファイル名の対応を検査していなかった。`physical_path` は既定プレイリストの先頭トラックの `file` から組み立て、トラックが無ければフォルダーを返していた。トラックが複数ある、別のファイルを指している、といった不整合は推測で埋められ、エラーにならなかった。

## 決定

### 形式の正本はmetaPathのファイル名

- `mimimilli.json` ならフォルダー形式、`<stem>.mimimilli.json` なら単一ファイル形式とする。
- メディアの基準ディレクトリ（mediaRoot）は、どちらの形式でも `dirname(metaPath)` にする。
- catalogに形式の列は足さない。mediaRootの列も足さない。どちらも `meta_path` から導出できるため。

### 判別型と解決関数（`shared/src/workPlacement.ts`）

```ts
type WorkPlacement =
  | { kind: "folder"; metaPath: string; mediaRoot: string }
  | { kind: "audio-file"; metaPath: string; mediaRoot: string };

function workPlacementOf(metaPath: string): WorkPlacement;

type WorkPlacementResolution =
  | { ok: true; placement: WorkPlacement; physicalPath: string }
  | { ok: false; placement: WorkPlacement; physicalPath: string; message: string };

function resolveWorkPlacement(
  metaPath: string,
  meta: Pick<MetaFile, "playlists" | "defaultPlaylistId">,
): WorkPlacementResolution;
```

- どちらも純粋関数で、ファイルシステムを見ない。パス区切りは `/` と `\` の両方を扱い、組み立てるパスには `metaPath` と同じ区切りを使う。
- `workPlacementOf` はcatalogに保存済みの `meta_path` から配置を得る関数で、後段が使う。メタの中身を要さない。
- `resolveWorkPlacement` はscan・登録の境界で使い、メタの中身を検査して `physicalPath` を決める。
  - フォルダー形式: `physicalPath` は mediaRoot。
  - 単一ファイル形式: 検査（後述）を通れば `physicalPath` は mediaRoot と音声ファイル名をつないだもの。通らなければ `physicalPath` は metaPath にして `ok: false` を返す。音声ファイルを特定できないので、フォルダーや先頭トラックで代用しない。
- `isAudioWorkPath` と `workMediaRoot` は廃止する。`isAudioFileName` は残す。登録やFilesで、`stat` と組み合わせて実体を判定する用途があるため。
- 後段の関数は `physicalPath` ではなく `WorkPlacement` を引数に取る。対象は再生時間の取得（`workProbe`・`catalogWorkRepository`・`workRowMapping`）、カバー配信（`coverMediaMethods`・`coverDto`・`coverSnapshot`）、DLsite画像の保存（`dlsiteApply`）、登録解除（`workRegister`）。文字列の `physicalPath` を渡す余地をシグネチャで無くす。
- catalogから配置を読むクエリ（`getMediaRoot`・`getCoverLocation` とその後継、一覧・詳細・facetのカバー解決）は `meta_path` をSELECTする。
- 登録解除は記録済みの `meta_path` だけを退避・削除の対象にする。`physical_path` からメタファイル名を組み立て直す探索はやめる。

### physical_path列は残す

`physical_path` は、Filesでの作品との照合（`fsBrowse`）、一覧の相対パス表示、登録済み判定と重複判定（`getWorkByPhysicalPathSync`・identity conflict・scanの既存行照合）に使っている。単一ファイル形式でこれを `meta_path` から導出するには音声ファイル名をトラック表から引く必要があり、照合クエリが重くなる。列は残し、形式の判定には使わない。

### 不整合はscan・登録の境界でエラーにする

scanと登録はどちらも同じ投影処理（`registerMetaFile`）を通る。ここで配置を検査し、不整合なら既存のエラー機構で作品を `status: "error"` にして `errorMessage` に理由を入れる。作品の状態の種類は増やさない。エラーは他のエラー（参照先ファイルの欠損、開始位置の超過）より先に判定する。

`resolveWorkPlacement` が純粋に検査するもの（単一ファイル形式だけ）:

- 既定プレイリストのトラックがちょうど1つである。
- そのトラックの `file` がパス区切りを含まず、音声拡張子を持ち、`sidecarMetaFileName(file)` がメタファイル名と一致する。大文字小文字の違いも含め、あいまいな一致はしない。
- 既定以外のプレイリストのトラックも、すべて同じ `file` を指す。単一ファイル形式は1つの音声ファイルの作品であり、区間違いのトラックは持てるが、別のファイルは持てない。

adapterが実体で検査するもの:

- 単一ファイル形式で、`physicalPath` がファイルとして存在する。ディレクトリだったり存在しなかったりすればエラーにする。
- フォルダー形式で、メタファイルが置かれたディレクトリが存在すること。メタファイルを読めた時点で成り立つので、追加の検査は置かない。

文言はすべて「配置形式が不整合です: 」で始め、どのメタファイルのどの点が合わないかを続ける。

```text
配置形式が不整合です: d00001.mimimilli.json の既定プレイリストにはトラックが1つだけ必要です（2件あります）
配置形式が不整合です: d00001.mimimilli.json のトラックが参照する d00002.mp3 は、このメタファイルに対応する音声ファイルではありません
配置形式が不整合です: d00001.mimimilli.json のプレイリスト「chapters」が d00001.mp3 以外のファイル（bonus.mp3）を参照しています
配置形式が不整合です: d00001.mimimilli.json が指す d00001.mp3 はファイルとして存在しません
```

メタを読めない（JSONやスキーマの不正）場合も同じ規則にそろえる。既存のcatalog行は `meta_path` の一致で探して error にし、`physical_path` はフォルダー形式なら mediaRoot、単一ファイル形式なら metaPath にする。メタの中身が無いので音声ファイルを特定しない。

配信やprobeの実行時は、catalogの配置をそのまま使う。見つからなければ従来どおり欠損として扱い、推測で補わない。

### fixture adapter

- `FixtureWorkRecord` に `metaPath` を持たせ、シードデータにも明示的に書く。
- fixtureの登録（Filesからの登録、候補の登録）は、その時点で形式を決めて `metaPath` を作る。fixtureは実体のファイルシステムを持たず、ファイルツリーも作品を並べ直した表示用のものなので、`stat` の代わりに登録対象のパス名が音声ファイル名かどうかで決める。この判定は登録の境界だけで行い、後段は `metaPath` だけを見る。
- fixtureの疑似scanは、各作品のプレイリストを `resolveWorkPlacement` に通し、不整合なら作品をエラーにする。realと同じ関数と同じ文言を使う。fixtureは実体の検査をしない。
- ファイルツリーの構築や再生用のプレイリスト合成は、形式を `workPlacementOf(metaPath)` で判定する。
- 単一ファイル形式の不整合がエラーになることを、realとfixtureの両方でadapterを通して確かめる契約テストを置く。

## 移行

### catalog

スキーマは変えない。既存のcatalog行は、次にその作品が再投影されるまで古い投影のまま残る。差分scanは変更の無い作品を読み飛ばすため、新しい検査はフルスキャンで全作品へ適用する。

1. アプリ画面上部の「スキャン」を開き、「すべて読み直す」を実行する
2. または API から `POST /api/scan` に `{"full":true}` を送る（例: `curl -X POST -H 'content-type: application/json' -d '{"full":true}' <サーバーのURL>/api/scan`）

### mimimilli.json

メタの形式は変えないので、値の移行は要らない。ただし、これまで推測で通っていた単一ファイル形式のメタが、フルスキャン後にエラーになりうる。次のコマンドで事前に検出できる。出力は `<理由>\t<メタファイルのパス>` で、理由は `tracks`（既定プレイリストのトラックが1つでない）、`file`（トラックの `file` がメタファイル名と対応しない）、`other-playlist`（既定以外のプレイリストが別のファイルを参照する）、`not-a-file`（音声ファイルが無い、またはディレクトリ）、`parse-error`（JSONとして読めない。従来から不正なメタとして診断に出るもの）のいずれか。何も出なければ対象は無い。

修正は利用者が手で行う。トラックを1つにまとめる、`file` を正しい音声ファイル名にする、複数ファイルの作品ならフォルダー形式へ移す（フォルダーを作って音声ファイルを入れ、メタを `mimimilli.json` として置き直す）のいずれか。

Linux / macOS（bash、`rg` と `jq` がPATHにあること）:

```bash
root="<ライブラリルート>"
filter='
  . as $m
  | ([$m.playlists[]? | select(.id == $m.defaultPlaylistId)][0]
     // (if $m.defaultPlaylistId then null else $m.playlists[0] end)) as $d
  | if $d == null or ($d.tracks | length) != 1 then "tracks"
    else $d.tracks[0].file as $f
      | if ($f | test("[/\\\\]"))
          or ($f | test("^.+\\.(mp3|m4a|aac|wav|ogg|flac|webm|opus)$"; "i") | not)
          or ($f | sub("\\.[^.]+$"; "")) != $stem
        then "file"
        elif any($m.playlists[].tracks[]; .file != $f) then "other-playlist"
        else "ok:" + $f
        end
    end'

rg --files -uu -g '*.mimimilli.json' "$root" | while IFS= read -r meta; do
  name=$(basename "$meta")
  [ "$name" = "mimimilli.json" ] && continue
  stem=${name%.mimimilli.json}
  if ! result=$(jq -r --arg stem "$stem" "$filter" "$meta" 2>/dev/null); then
    printf 'parse-error\t%s\n' "$meta"
    continue
  fi
  case "$result" in
    ok:*) [ -f "$(dirname "$meta")/${result#ok:}" ] || printf 'not-a-file\t%s\n' "$meta" ;;
    *) printf '%s\t%s\n' "$result" "$meta" ;;
  esac
done
```

Windows（PowerShell 7.3以降（`pwsh`）。`jq` がPATHにあること。7.2以前はjqへ渡す引数の二重引用符が外れ、Windows PowerShell 5.1はjqのUTF-8出力を誤読するため対象外）:

```powershell
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$libraryRoot = "<ライブラリルート>"
$filter = @'
  . as $m
  | ([$m.playlists[]? | select(.id == $m.defaultPlaylistId)][0]
     // (if $m.defaultPlaylistId then null else $m.playlists[0] end)) as $d
  | if $d == null or ($d.tracks | length) != 1 then "tracks"
    else $d.tracks[0].file as $f
      | if ($f | test("[/\\\\]"))
          or ($f | test("^.+\\.(mp3|m4a|aac|wav|ogg|flac|webm|opus)$"; "i") | not)
          or ($f | sub("\\.[^.]+$"; "")) != $stem
        then "file"
        elif any($m.playlists[].tracks[]; .file != $f) then "other-playlist"
        else "ok:" + $f
        end
    end
'@
$suffix = ".mimimilli.json"

Get-ChildItem -LiteralPath $libraryRoot -Recurse -File -Force -Filter "*$suffix" |
  Where-Object { $_.Name -ne "mimimilli.json" } |
  ForEach-Object {
    $meta = $_.FullName
    $stem = $_.Name.Substring(0, $_.Name.Length - $suffix.Length)
    $result = (& jq -r --arg stem $stem $filter $meta 2>$null) -join ""
    if ($LASTEXITCODE -ne 0) { "parse-error`t$meta"; return }
    if ($result.StartsWith("ok:")) {
      $audio = Join-Path $_.DirectoryName $result.Substring(3)
      if (-not (Test-Path -LiteralPath $audio -PathType Leaf)) { "not-a-file`t$meta" }
    } else {
      "$result`t$meta"
    }
  }
```

## 範囲外

- scanの未登録候補（`ScanCandidate`）はフォルダーだけのままにする。単一ファイル形式の自動検出は加えない。単一ファイル形式の作品は、これまでどおりFilesから音声ファイルを指定して登録する。
- DLsite連携の利用者向け仕様（DRAFT-74）と一括取得の運用（DRAFT-76）とは別の軸である。`dlsiteApply` はカバー画像の保存先を配置から得るようになるだけで、登録時のDLsite適用（`workRegister` の `buildMetaFromDlsiteApply` など）のシグネチャは変えない。

## 帰結

- 後段は形式を推測しない。対応拡張子を変えても既存作品の解釈は変わらず、拡張子で終わる名前のフォルダーも正しく扱える。
- 単一ファイル形式のメタの不整合が、症状の出る場所（404や欠損）ではなく、scan・登録の時点で理由つきのエラーとして見える。
- メタを手で編集して単一ファイル形式に複数のファイルを持たせる使い方はできなくなる。複数ファイルの作品はフォルダー形式にする。
- 不整合な単一ファイル形式の作品は、`physical_path` がメタファイルのパスになる。Filesではメタファイルの行にエラーの作品として現れる。
- 形式の判定がmetaPathのファイル名に閉じるので、形式を増やすときは `workPlacementOf` と `resolveWorkPlacement` を変えれば後段へ伝わる。
