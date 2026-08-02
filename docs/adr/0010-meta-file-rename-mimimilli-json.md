# ADR-0010: メタファイル名を mimimilli.json に変更する

- ステータス: 承認
- 日付: 2026-08-02
- 関連: [requirements-v4.md](../requirements-v4.md) §2.3、[ARCHITECTURE.md](../ARCHITECTURE.md)

## 文脈

作品メタデータの Source of Truth は作品フォルダー内（または単一ファイル形式では同階層）の JSON ファイルである。旧名称 `.meta.json` は一般名詞すぎて他ツールとの衝突や検索性に難があり、Windows では先頭ドット付きファイルが隠れないためドットの意味も薄い。

## 決定

メタファイル名をブランド名を冠した `mimimilli.json`（ドットなし）へ変更する。

- フォルダー形式: `mimimilli.json`
- 単一ファイル形式: `<basename>.mimimilli.json`（旧 `*.meta.json` の置き換え）
- 判定: `name === "mimimilli.json"` または `name.endsWith(".mimimilli.json")`
- 既存の `.meta.json` / `*.meta.json` はユーザーが手動でリネームして移行する（アプリはスキャン時に旧名へ触らない）
- 旧名の読み取りフォールバックは残さない

### 手動移行コマンド例

ライブラリルートを `<ルート>` とする。

フォルダー形式（`.meta.json` → `mimimilli.json`）:

```bash
find <ルート> -type f -name '.meta.json' -execdir mv {} mimimilli.json \;
```

単一ファイル形式（`*.meta.json` → `*.mimimilli.json`。フォルダー形式の `.meta.json` は除外）:

```bash
find <ルート> -type f -name '*.meta.json' ! -name '.meta.json' | while read -r f; do mv "$f" "${f%.meta.json}.mimimilli.json"; done
```

移行後にスキャンを実行する。作品 ID・タグ等はメタファイルの内容がそのまま維持される。

## 帰結

- ライブラリ内でメタファイルを名前検索しやすくなる
- スキャナは新名のみを認識し、コードパスが単一に保たれる
- 旧名ライブラリは移行コマンド実行後にスキャンで登録される
