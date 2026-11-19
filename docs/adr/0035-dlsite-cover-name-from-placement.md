# ADR-0035: DLsiteカバーの保存名を作品の配置から導く

- ステータス: 承認
- 日付: 2026-11-19
- 関連: [ADR-0032](0032-work-placement-from-meta-path.md)（配置をmetaPathから得る）、[ADR-0033](0033-dlsite-fetch-before-register.md)（DLsite取得と適用の契約。revisionの定義を本ADRで置き換え）、backlog TASK-512

## 文脈

単一ファイル形式の作品は、音声ファイルと同じフォルダーに `<stem>.mimimilli.json` を置く。同じフォルダーに複数の単一ファイル作品が並ぶことは普通にある。

一方、DLsiteのカバーは作品フォルダー（mediaRoot）に `dlsite_cover.<ext>` の固定名で保存していた。フォルダー形式ならmediaRootが作品ごとに別なので衝突しないが、単一ファイル形式ではmediaRootが共有される。同じフォルダーの2作品にカバーを適用すると、後から適用した作品のカバーが先の作品のファイルを上書きし、複数のメタが同じファイルを指したまま、先の作品の絵が変わる。

保存の手順も形式ごとに散らばっていた。ステージ、最終名への確定、メタ保存、失敗時の巻き戻し、後始末が、Files登録・孤立メタの復元・候補の登録・作品詳細の適用で別々に書かれ、適用だけはメタ保存に失敗しても巻き戻さなかった。巻き戻しも、新規作成なら消すだけで、同名の旧カバーを上書きしたときに旧内容へ戻さなかった。

作品詳細の適用の照合値 `infoRevision` は、解析結果の取得時刻だけだった。パーサーの版が上がって同じ取得時刻の解析結果が変わっても、確認したときの内容で適用できてしまった。

## 決定

### 保存名

カバーの保存名はメタファイル名から導く。導出関数は `shared/src/workPlacement.ts` の `dlsiteCoverBaseName(placement)` で、配置形式を受け取る。

| 配置形式     | メタファイル名          | カバー名                    |
| ------------ | ----------------------- | --------------------------- |
| フォルダー   | `mimimilli.json`        | `dlsite_cover.<ext>`        |
| 単一ファイル | `<stem>.mimimilli.json` | `<stem>.dlsite_cover.<ext>` |

`<ext>` は画像の中身から決める（従来どおり）。単一ファイル形式のカバー名は、メタ名の `.mimimilli.json` を `.dlsite_cover` に置き換えた形にする。そのため、カバー名の一意性はメタファイル名の一意性と同じになり、同じフォルダーの別作品のカバーとは重ならない。フォルダー形式は変わらない。

保存先のディレクトリは `WorkPlacement.mediaRoot`、名前は `WorkPlacement.metaPath` から導く。呼び出し側がmediaRootの文字列だけを渡す形にはしない。

### 保存手順を1か所にまとめる

`saveWithDlsiteCover`（`server/src/adapters/real/dlsiteCoverStaging.ts`）が、ステージ・配置・メタ保存・失敗時の巻き戻し・後始末をまとめて持つ。メタの保存は呼び出し側がコールバックで渡す。Files登録、孤立メタの復元、候補の登録、作品詳細の適用がすべてこれを使う。

- 配置するとき、同名の既存ファイルは退避名へ移してから新しいカバーを置く。メタ保存に成功したら退避を消し、失敗したら新しいカバーを消して退避を元の名前へ戻す。旧カバーは失われない。
- 配置するかどうかはコールバックが決める。適用は、メタの版を確かめて書く内容を決めた後で配置する。
- 保存に成功したとき、保存前のメタの `coverImage` が、自分の配置から導いた名前で拡張子だけ違うファイルなら、そのファイルを消す。消してよいのは自分の配置から導いた名前だけで、旧固定名 `dlsite_cover.<ext>` は同じフォルダーの別作品のメタが参照している可能性があるため、単一ファイル作品の処理では触らない。
- 巻き戻し自体が失敗したときは、ログに残して元のエラーを投げ直す。
- 登録と復元は、メタの書き込みまでをこの手順に含め、catalogへの投影は手順の外で行う。投影が失敗しても、メタが指す新しいカバーは消えない。

### 適用の照合値

`infoRevision` は、解析結果の取得時刻とパーサー版の組を表す不透明な文字列にする。サーバーはDLsite情報の解決結果（`DlsiteProductResolution.revision`）で1か所だけ組み立て、クライアントは取得応答の値をそのまま適用に送り返す。取得時刻かパーサー版のどちらかが変わると、適用は409 `dlsite_refetch_required` になる。

### 同期取得の待ち

カバー先取りの終了時に、スケジューラのキュー全体の完了を待つ処理（`drain`）を外す。待っていたのは自分の通信ではなく、キューの後ろに積まれた別ジョブの通信だった。中止されたジョブの後始末は、ジョブ・停止・再設定の側が `fetchDlsiteProduct` の中止時に持つ。要求元が中止して返った後も続くflightは、adapterの `close` が自前の中止信号で中止してからキャッシュとDBを閉じる。通信の完走は待たず、中止後のflightはキャッシュへ書かない。

## 帰結

- 同じフォルダーの単一ファイル作品が、それぞれ自分のカバーを持てる。
- 保存の手順の抜けが1か所で直る。適用のメタ保存失敗でも、新しいカバーが残らず旧カバーも失われない。
- すでに上書きされて失われたカバーは戻らない。単一ファイル作品の既存カバーの名前は変わらないまま残るので、手動で移行する。
- 同期取得が、別ジョブの通信の長さに引きずられなくなる。

## 移行

メタファイルの形式は変えない。影響があるのは、単一ファイル作品（`<stem>.mimimilli.json`）のうち `coverImage` が旧固定名 `dlsite_cover.<ext>` を指しているものだけ。フォルダー形式の作品は名前が変わらないので対象外。

リネーム（`mv`）では移行しない。同じ `dlsite_cover.jpg` を複数のメタが指しているので、1つの作品のために名前を変えると他の作品の参照が切れる。次の順で、作品ごとにカバーを再適用する。

1. `dlsite_cover.` を参照しているサイドカーメタを洗い出す。

   Linux / macOS（bash、`rg` がPATHにあること）:

   ```bash
   root="<ライブラリルート>"
   rg -uu -l --glob '*.mimimilli.json' '"coverImage"\s*:\s*"dlsite_cover\.' "$root"
   ```

   Windows（PowerShell）:

   ```powershell
   $root = "<ライブラリルート>"
   Get-ChildItem -Path $root -Recurse -File -Force -Filter '*.mimimilli.json' |
     Where-Object { Select-String -Path $_.FullName -Pattern '"coverImage"\s*:\s*"dlsite_cover\.' -Quiet } |
     ForEach-Object FullName
   ```

2. 洗い出した作品ごとに、作品詳細のDLsiteダイアログで取得し、カバーを選んで適用する。キャッシュのTTLが切れているときは、取得からやり直す。新しいカバーは `<stem>.dlsite_cover.<ext>` で保存され、メタの `coverImage` もその名前になる。

3. どのメタからも参照されなくなった旧ファイルを探して消す。まず一覧を確認する。

   Linux / macOS:

   ```bash
   find "$root" -type f -name 'dlsite_cover.*' | while IFS= read -r f; do
     if ! rg -uu -q --max-depth 1 --glob '*mimimilli.json' -F "\"$(basename "$f")\"" "$(dirname "$f")"; then
       echo "$f"
     fi
   done
   ```

   Windows（PowerShell）:

   ```powershell
   Get-ChildItem -Path $root -Recurse -File -Force -Filter 'dlsite_cover.*' | Where-Object {
     $name = $_.Name
     -not (Get-ChildItem -Path $_.DirectoryName -File -Force -Filter '*mimimilli.json' |
       Select-String -SimpleMatch "`"$name`"" -Quiet)
   } | ForEach-Object FullName
   ```

   この一覧には、フォルダー形式の作品で使われなくなった旧カバーも出る。不要になったものだけを消してよい。一覧を確認してから、各ファイルを削除する（bashは `rm`、PowerShellは `Remove-Item`）。

## 既存ADRのうち置き換える箇所

- [ADR-0033](0033-dlsite-fetch-before-register.md): 作品詳細の適用の照合値 `infoRevision` の定義を、「確認したDLsite情報の取得時刻」から「解析結果の取得時刻とパーサー版の組（不透明な文字列）」に置き換える。それ以外の適用の契約（サーバーがキャッシュから読む、409 `dlsite_refetch_required`・`source_changed`）は変えない。
