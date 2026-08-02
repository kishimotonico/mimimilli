# Windows 実機 smoke

TASK-168 AC#3（Windowsネイティブでの LogTape file sink + Bun compile 検証）用の手順です。Windows 10 version 1809 以降の x64 環境を想定します。

## 手順

リポジトリを pull し、このディレクトリで次を実行します。

```powershell
cd scripts\spike\logtape-file-sink
bun install
bun run src\spike.ts --mode normal
bun build --compile --outfile artifacts\spike-bin.exe src\spike.ts
.\artifacts\spike-bin.exe --mode normal
```

WSL で事前に exe を作る場合は `bun run build:windows` で `artifacts\windows-x64\logtape-spike.exe` を生成し、Windows へコピーしても構いません。

## 合格条件（normal モード）

- `logs\test.jsonl` が生成される
- 行数が 30 行（1 行 1 JSON）
- 日本語メッセージが文字化けしない（例: `処理を開始しました`）
- 各 JSON に `workId` や `seq` などの文脈フィールドが含まれる

## 任意: flush 確認

### exit-immediate モード

```powershell
Remove-Item logs\test-exit.jsonl -ErrorAction SilentlyContinue
bun run src\spike.ts --mode exit-immediate --log-path logs\test-exit.jsonl
(Get-Content logs\test-exit.jsonl | Measure-Object -Line).Lines
```

`dispose()` を呼ばないため、30 行未満になることがあります（WSL では 23〜24 行）。本番では `await dispose()` が必要です。

### sigint-loop モード

```powershell
Remove-Item logs\test-sigint.jsonl -ErrorAction SilentlyContinue
bun run src\spike.ts --mode sigint-loop --log-path logs\test-sigint.jsonl
# 数秒待って Ctrl+C
(Get-Content logs\test-sigint.jsonl | Measure-Object -Line).Lines
```

SIGINT 前に emit された行がファイルに残っていれば成功です。ハンドラ内で `dispose()` を呼ぶ実装になっています。

結果は TASK-168 のタスクノートへ記録してください（Windows の版、Bun の版、各コマンドの終了コード、行数）。
