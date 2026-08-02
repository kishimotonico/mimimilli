# LogTape file sink スパイク

TASK-168 AC#3（Windowsネイティブ検証）向けの実証コードです。LogTape の file sink を `bun build --compile` した単一バイナリで動かせるかを確認します。既存 server とは独立しており、実行時のログは `logs/` に出力します（Git 管理外）。

## 再実行

Bun 1.3.14 / LogTape 2.3.0 で確認しています。

```bash
cd scripts/spike/logtape-file-sink
bun install
bun run spike
bun run compile
./artifacts/spike-bin --mode normal

# WSL から Windows x64 用 exe を生成する
bun run build:windows
```

`--mode` には `normal`（既定）、`exit-immediate`（dispose なし即終了）、`sigint-loop`（SIGINT までループ）があります。Windows 実機での手順は [WINDOWS-SMOKE.md](WINDOWS-SMOKE.md) を参照してください。

## WSL 側の結果（2026-08-02）

条件付き合格です。

| 項目                                   | 結果                                 |
| -------------------------------------- | ------------------------------------ |
| `bun run` + file sink + JSONL          | 30/30 行、日本語・文脈フィールド正常 |
| `bun build --compile` 単一バイナリ     | 同上                                 |
| SIGINT + ハンドラ内 `dispose()`        | flush 確認済み                       |
| `process.exit(0)` のみ（dispose なし） | 23〜24/30 行で末尾欠落               |

本番導入時の注意点は次の3つです。

1. compile 後は `import.meta.dir` が `/$bunfs` になる。ログパスは `process.argv[0]` 基準（本スクリプトの `getSpikeRoot()`）で解決すること
2. 既定 `bufferSize`（8192）のまま `process.exit()` するとバッファが捨てられる。正常終了時は `await dispose()` が必須
3. SIGINT はハンドラ内で `dispose()` を呼ぶこと。デフォルトの exit フック頼みでは不足

## ファイル

- `src/spike.ts`: 3 モードの検証エントリ
- `src/build-compile.ts`: ローカル向け `bun build --compile`
- `src/build-windows.ts`: Windows x64 向けクロスコンパイル
