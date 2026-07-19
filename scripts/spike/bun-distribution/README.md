# Bun配布スパイク

TASK-70で使った、既存serverから独立した実証コードです。既存serverのDBやポートには接続しません。実行時のDBとexeは `artifacts/` に出力し、Git管理から除外します。

## 再実行

Bun 1.3.14で確認しています。

```bash
cd scripts/spike/bun-distribution
bun install --frozen-lockfile
bun run smoke:sqlite
bun run smoke:server
bun run probe:node-server
bun run probe:sharp

# WSLからWindows x64用依存を選び、exeを生成する
bun run deps:windows
bun run build:windows
```

`better-sqlite3` のinstall scriptがnpm cacheへ書けない環境では、`npm_config_cache` に書き込み可能な一時ディレクトリを指定します。これはCIやsandbox向けの回避であり、配布物のパスには影響しません。

## 2026-07-19の結果

| 対象                       | Bun上の実行                                                                       | Windows x64 compile | 判断                                                          |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| `bun:sqlite`               | migration、close、別プロセスでの再オープン、catalog/user同時接続、`ATTACH` が成功 | 成功                | 採用                                                          |
| `better-sqlite3` 12.10.0   | `ERR_DLOPEN_FAILED`。Bun 1.3.14が未対応として拒否                                 | exe生成は成功       | compile成功だけでは動作を示さないため不採用                   |
| Hono + `Bun.serve`         | HTTP書き込み、停止、再起動後読み込みが成功                                        | 成功                | 採用                                                          |
| `@hono/node-server` 1.14.0 | 応答は成功するが `Failed to find Response internal state key` を出力              | 成功                | 配布entryでは使わない                                         |
| `sharp` 0.35.3             | Linux用native addonでPNG生成・読み込みが成功                                      | exe生成は成功       | Windows addonとDLLの単一exe内蔵は未実証。外部配布物として扱う |

`bun build --compile` はnative addonの実行可能性を検査しません。`better-sqlite3` は実行不能でもexeを生成しました。sharpもtarget用packageを取得するとcompileは通りますが、生成exe内にaddonとDLLが入ったことは確認できません。Windows側の確認は [WINDOWS-SMOKE.md](WINDOWS-SMOKE.md) に分けています。

## ファイル

- `src/sqlite/`: ドライバ別の永続化probe
- `src/run-sqlite-smoke.ts`: 書き込みと読み込みを別プロセスで実行する比較runner
- `src/compiled-server.ts`: Hono + `Bun.serve` + `bun:sqlite` の最小配布entry
- `src/run-server-smoke.ts`: serverを2回起動してHTTP越しの永続化を検査
- `src/probes/`: native dependencyとNode server adapterの切り分け
- `src/build-windows.ts`: Windows x64 exeのbuild matrix
