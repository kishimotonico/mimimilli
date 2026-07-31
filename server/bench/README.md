# Bench scripts

パフォーマンス計測用の開発専用スクリプト。ユーザーの実DBには触れません。

## 手順

```bash
# 1. シード生成（デフォルト3万件、/tmp 配下に出力）
pnpm --filter @mimimilli/server bench:seed -- --out-dir /tmp/mimimilli-bench

# 件数・乱数seedを変える場合
pnpm --filter @mimimilli/server bench:seed -- --count 5000 --seed 42 --out-dir /tmp/mimimilli-bench

# 2. ベンチ実行（in-process Hono、開発サーバー不要）
pnpm --filter @mimimilli/server bench:run -- --data-dir /tmp/mimimilli-bench --out-dir /tmp/mimimilli-bench
```

`--out-dir` を bench:run で省略すると `--data-dir` と同じ場所に `bench-baseline.md` と `bench-results.json` を書きます。

オプション: `--warmup 3`（既定）、`--iterations 20`（既定）。
