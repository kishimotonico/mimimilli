# Windows実機smoke

WSLで生成したWindows x64 exeについて、起動とDB再オープンを確認する手順です。Windows 10 version 1809以降のx64環境を使います。

## WSLでの生成

リポジトリルートから実行します。Bunがなければ公式手順でユーザーローカルへ入れてください。

```bash
curl -fsSL https://bun.com/install | bash
export PATH="$HOME/.bun/bin:$PATH"
cd scripts/spike/bun-distribution
bun install --frozen-lockfile
bun run smoke:sqlite
bun run smoke:server
bun run deps:windows
bun run build:windows
```

`artifacts/windows-x64/` を任意の方法でWindowsへコピーします。実行ファイルは約94〜95 MBです。

## PowerShellでの本命exe確認

PowerShellでコピー先へ移動してから実行します。データはexeの隣ではなく、一時ディレクトリに明示的に分離します。

```powershell
$DataDir = Join-Path $env:TEMP "mimikago-bun-spike"
$env:MIMIKAGO_DATA_DIR = $DataDir
$env:PORT = "1370"
Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue

$Server = Start-Process -FilePath ".\mimikago-bun-sqlite.exe" -PassThru
Start-Sleep -Seconds 1
Invoke-RestMethod "http://127.0.0.1:1370/health"
Invoke-RestMethod "http://127.0.0.1:1370/values/windows" `
  -Method Put `
  -ContentType "application/json" `
  -Body '{"value":"persisted"}'
Stop-Process -Id $Server.Id
Wait-Process -Id $Server.Id -ErrorAction SilentlyContinue

$Server = Start-Process -FilePath ".\mimikago-bun-sqlite.exe" -PassThru
Start-Sleep -Seconds 1
$Health = Invoke-RestMethod "http://127.0.0.1:1370/health"
$Value = Invoke-RestMethod "http://127.0.0.1:1370/values/windows"
$Health
$Value
Test-Path (Join-Path $DataDir "spike.sqlite")
Stop-Process -Id $Server.Id
```

合格条件は次のとおりです。

- 1回目と2回目の `/health` が `ok: true`
- 2回目の `launches` が `2`
- 2回目の `/values/windows` が `value: persisted`
- `$DataDir\spike.sqlite` が存在し、exeの隣にDBが作られていない

`MIMIKAGO_DATA_DIR` を指定しない確認も行う場合、DBの既定位置は `$env:LOCALAPPDATA\Mimikago\spike.sqlite` です。確認後のDBは利用者の判断で削除してください。

## 切り分けprobe

```powershell
.\probe-hono-node-server.exe
.\probe-better-sqlite3.exe
.\probe-sharp.exe
```

- `probe-hono-node-server.exe`: `runtime probe: ok` と出て終了すれば成功。ただし本命は `Bun.serve` を使う
- `probe-better-sqlite3.exe`: compile可否と実行可否が異なることを示すprobe。Bun 1.3.14では失敗を想定
- `probe-sharp.exe`: `runtime probe: ok` ならWindows addonを利用できている。ただし現時点ではaddonとDLLの単一exe内蔵を保証しないため、本番配布判断には使わない

結果をTASK-70へコメントするときは、Windowsの版、CPU、各exeの終了コード、標準出力と標準エラーを記録します。
