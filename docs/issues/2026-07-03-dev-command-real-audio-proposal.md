# 実音声テストを見据えた開発コマンド整理案

Status: done — b790b69 で実施

作成: 2026-07-03 / Codex

## 背景

現在の `pnpm dev` は fixture アダプタを使う開発体験をデフォルトにしている。
これは UI 開発・ビジュアル回帰・シナリオ再現には適している一方、今後は実際の MP3 / m4a ファイルを使った再生・スキャン・メディア配信の確認も日常的に行えるようにしたい。

ただし、実ファイルをデフォルトに寄せると、手元ライブラリの有無、スキャン時間、DB 状態、ファイル差分により日常開発の再現性が落ちる。
そのため、デフォルトは fixture のまま維持しつつ、real アダプタを使う入口を `package.json` 上で明確に分離するのがよい。

## 現状

ルートの `package.json` は以下の入口を持つ。

```json
{
  "dev": "pnpm --filter @mimimilli/client dev",
  "dev:real": "pnpm --filter @mimimilli/client dev:real",
  "dev:server": "pnpm --filter @mimimilli/server dev"
}
```

実体は次の通り。

- `pnpm dev`: client の Vite を起動し、`BACKEND_URL` 未指定のため fixture API を Vite middleware として同居させる
- `pnpm dev:server`: server を起動する。server 側の `MIMIMILLI_ADAPTER` デフォルトは `real`
- `pnpm dev:real`: client のみ起動し、`BACKEND_URL=http://localhost:8080` へプロキシする

つまり `dev:real` という名前は real 環境全体の起動に見えるが、実際には client 側だけを起動する。
real アダプタを使うには別ターミナルで `pnpm dev:server` も必要で、コマンド名と運用実態に少しズレがある。

## 提案

開発コマンドは「データソース」と「起動対象」で命名する。
`pnpm dev` は fixture のエイリアスとして維持する。

```json
{
  "dev": "pnpm dev:fixture",

  "dev:fixture": "pnpm --filter @mimimilli/client dev",
  "dev:fixture:new-work": "cross-env MIMIMILLI_MOCK_SCENARIO=new-work pnpm --filter @mimimilli/client dev",
  "dev:fixture:empty": "cross-env MIMIMILLI_MOCK_SCENARIO=empty pnpm --filter @mimimilli/client dev",
  "dev:fixture:errors": "cross-env MIMIMILLI_MOCK_SCENARIO=errors pnpm --filter @mimimilli/client dev",

  "dev:real:server": "pnpm --filter @mimimilli/server dev",
  "dev:real:client": "pnpm --filter @mimimilli/client dev:real",
  "dev:real": "concurrently -n api,web \"pnpm dev:real:server\" \"pnpm dev:real:client\"",

  "smoke:real": "pnpm --filter @mimimilli/server smoke:real"
}
```

### 命名の意図

- `dev`: 日常開発の最短入口。これまで通り fixture
- `dev:fixture`: fixture 開発であることを明示した入口
- `dev:fixture:*`: `MIMIMILLI_MOCK_SCENARIO` を覚えずに代表シナリオを起動する入口
- `dev:real:server`: real アダプタの API server
- `dev:real:client`: real API に向けた client
- `dev:real`: real server + client の一括起動
- `smoke:real`: 管理されたサンプルライブラリで real 経路を確認する入口

## 段階的な導入案

### Phase 1: 破壊的でない命名整理

まずは追加エイリアスだけ導入する。
依存追加は不要。

```json
{
  "dev": "pnpm dev:fixture",
  "dev:fixture": "pnpm --filter @mimimilli/client dev",
  "dev:real:server": "pnpm --filter @mimimilli/server dev",
  "dev:real:client": "pnpm --filter @mimimilli/client dev:real"
}
```

この時点では既存の `dev:server` / `dev:real` を残してもよい。
README では新名を正とし、旧名は互換エイリアスとして扱う。

### Phase 2: fixture シナリオ起動を明示化

`MIMIMILLI_MOCK_SCENARIO` を直接覚えなくてよいように、代表シナリオのコマンドを追加する。

```json
{
  "dev:fixture:new-work": "cross-env MIMIMILLI_MOCK_SCENARIO=new-work pnpm --filter @mimimilli/client dev",
  "dev:fixture:empty": "cross-env MIMIMILLI_MOCK_SCENARIO=empty pnpm --filter @mimimilli/client dev",
  "dev:fixture:errors": "cross-env MIMIMILLI_MOCK_SCENARIO=errors pnpm --filter @mimimilli/client dev"
}
```

`cross-env` は client 側に既に入っているが、ルート scripts から使うならルート devDependency に置くか、`pnpm --filter @mimimilli/client` 側へ script を寄せるかを決める必要がある。

### Phase 3: real 一括起動

`dev:real` を server + client の一括起動にする。
この場合は `concurrently` などの依存追加が必要になる。

```json
{
  "dev:real": "concurrently -n api,web \"pnpm dev:real:server\" \"pnpm dev:real:client\""
}
```

この変更は既存の `dev:real` の意味を変える。
そのため、先に `dev:real:client` を追加して README を更新してから、別コミットで `dev:real` の意味を切り替える方が安全。

### Phase 4: 実ファイル検証の初期設定を簡略化

real アダプタは root folder を DB の settings から読む。
そのため、初回 real 起動では UI から root folder を設定する必要がある。

実MP3/m4aを使う手動検証を軽くするなら、将来的に次のような env を検討する。

```bash
MIMIMILLI_ROOT_FOLDER=/mnt/c/Users/nico/Music/mimimilli-test-library pnpm dev:real
```

実装案:

- server 起動時に `MIMIMILLI_ROOT_FOLDER` が指定されていれば、存在確認・realpath 正規化して settings に保存する
- DB は `MIMIMILLI_DB` で指定可能な現状を維持する
- 指定フォルダーが存在しない場合は起動時に失敗させる。過度なフォールバックはしない

この機能は便利だが、package scripts の整理とは別タスクにしてよい。

### Phase 5: 管理された real smoke を昇格

既に `server/tests/helpers/sampleLibrary.ts` は有効な WAV を生成できる。
`server/tests/helpers/smoke.ts` も real アダプタの設定、スキャン、works 一覧・ソート、missing view、axes/cv ファセット、fs、Range 配信を一通り確認している。

これを `server/package.json` の script として昇格する。

```json
{
  "smoke:real": "node tests/helpers/smoke.ts"
}
```

ルートからは次のように呼ぶ。

```json
{
  "smoke:real": "pnpm --filter @mimimilli/server smoke:real"
}
```

実MP3/m4aとは別に、管理されたサンプル音声で real 経路を確認できるため、CI やレビュー前確認にも使いやすい。

## README 更新方針

README の開発サーバー起動説明は次の構成へ整理する。

```bash
# 日常開発: fixture API 同居
pnpm dev

# fixture シナリオ
pnpm dev:fixture:new-work
pnpm dev:fixture:empty
pnpm dev:fixture:errors

# 実ファイル確認: ターミナルを分ける場合
pnpm dev:real:server
pnpm dev:real:client

# 実ファイル確認: 一括起動を導入後
pnpm dev:real
```

実ファイル用ライブラリの置き場所例は WSL 前提で書く。

```bash
MIMIMILLI_ROOT_FOLDER=/mnt/c/Users/nico/Music/mimimilli-test-library pnpm dev:real
```

Windows パスを直接書くより、WSL パスへ変換した例を README に載せる。

## Claude レビュー観点

- `dev:real` の意味を「client のみ」から「server + client」へ変えるタイミングは妥当か
- `dev:server` を残すか、`dev:real:server` へ寄せて非推奨にするか
- `cross-env` / `concurrently` をルート devDependency に追加するか、client/server 側 scripts に閉じ込めるか
- `MIMIMILLI_ROOT_FOLDER` の自動 settings 反映は package scripts 整理と同時にやるべきか、別 issue に分けるべきか
- `smoke:real` は `node tests/helpers/smoke.ts` のまま十分か、`node --test` ベースのテストとして整えるべきか

## 推奨結論

短期は Phase 1 + Phase 2 だけ実施する。
これにより既存の fixture 開発体験を壊さず、コマンド名の意図を明確にできる。

中期で Phase 3 を入れ、`pnpm dev:real` を real 検証の一括入口にする。
実MP3/m4aのパス指定を楽にする `MIMIMILLI_ROOT_FOLDER` 対応は、real 起動運用が固まってから別タスクとして入れるのがよい。

## Claude レビュー（2026-07-03）

方向性に賛成。「データソース × 起動対象」の命名規則は現状の `dev:real`（実態は client のみ）の紛らわしさを正しく解消している。事実確認は Codex に実コード照合を依頼し、以下の結果を得た。

### 事実確認の結果

「現状」節の3入口の説明、`MIMIMILLI_ADAPTER` デフォルト `real`（`server/src/index.ts:14`）、ポート 8080（`index.ts:27`、`PORT` で変更可）、real アダプタが root folder を DB settings から読む点（`server/src/adapters/real/index.ts` の `requireRoot()`）はすべて実コードと一致。`cross-env`・`concurrently` がルートに無い点、`MIMIMILLI_ROOT_FOLDER` が未実装である点も記述どおり。

相違・補足は3点。

- smoke.ts の検証内容に「検索」とあるが、実際は works 一覧・ソート・missing view・axes/cv（ファセット）であり、`?q=` のテキスト検索は含まない。「一覧・ソート・ファセット」と書くのが正確
- `sampleLibrary.ts` が生成できるのは WAV のみ。MP3/m4a のメタデータ解析・配信の確認は smoke では代替できない。提案書が「管理 WAV smoke」と「実 MP3/m4a 手動検証」を別物として整理しているのは妥当だが、smoke がカバーしない範囲として明記しておくとよい
- root folder 未設定時、現状の server は正常起動し、API 呼び出し時に `NotConfiguredError` を遅延的に投げる。Phase 4 の「存在しなければ起動時に失敗」は現状挙動からの設計変更になる。なお `updateSettings` 経路に `realpathSync` による存在確認・正規化が既にあるので、Phase 4 実装時はこれを再利用すればよい

### レビュー観点への回答

`dev:real` の意味切り替えタイミング: Phase 3 まで待たなくてよい。AGENTS.md は互換性を重視しない方針なので、「先に `dev:real:client` を足して別コミットで切り替え」という段取り自体が過剰。Phase 1 の時点でリネームを一括で済ませる方がシンプル。

`dev:server` の扱い: 削除して `dev:real:server` に一本化する。同じ実体に2つの名前が残る方が混乱する。互換エイリアス期間は不要。

`cross-env` / `concurrently`: 今後 Windows ネイティブ環境でもデバッグする前提のため、env 代入を素書きする書き方（`VAR=x pnpm ...`）はルート scripts に置けない。それでもルートへの依存追加は避けられる。

- `cross-env`: シナリオ scripts は client 側に置く。client には cross-env が導入済みで、既存の `dev` / `dev:real` も cross-env を使っているため一貫する。client に `dev:new-work` / `dev:empty` / `dev:errors` を追加し、ルートは `"dev:fixture:empty": "pnpm --filter @mimimilli/client dev:empty"` のような純粋なフィルタ呼び出しにすれば、ルート scripts に env 構文が一切現れず OS 非依存になる
- `concurrently`: server 側に `"dev:real": "node --watch src/index.ts"`（dev と同実体）を足せば、ルートは `"dev:real": "pnpm -r --parallel dev:real"` で依存追加ゼロで一括起動できる。この方式は Windows でもそのまま動く。pnpm がパッケージ名プレフィックス付きでログを流すので `-n api,web` 相当も得られる。concurrently の方がログ整形は柔軟だが、この規模では見合わない

`MIMIMILLI_ROOT_FOLDER`: 別 issue に分ける案に賛成。scripts 整理は純粋なリネームで済むが、こちらは「settings への副作用を持つ env」という新しい挙動の導入で、fixture アダプタ時に無視するかエラーにするかなど決めることが多い。

`smoke:real`: 当面は script 昇格のままで十分。smoke.ts はプレーンスクリプト（node:test 非依存、top-level await）なので `node tests/helpers/smoke.ts` で動き、アサーション失敗時は unhandled rejection で exit code 非0 になるため CI でも使える。`node --test` 化は server test への統合が欲しくなった時でよい。ただし cwd 依存（`data/smoke` への相対書き込み）があるので、ルートから呼ぶ場合は `pnpm --filter` 経由必須である点だけ注意。

### 追加の指摘

- Phase 2 導入後は README の `MIMIMILLI_MOCK_SCENARIO` 直書き案内（現 README 59-62行付近）を `dev:fixture:*` に置き換えて一本化する。入口が2系統残ると scripts を足した意味が薄れる。現行案内の `MIMIMILLI_MOCK_SCENARIO=new-work pnpm dev` という素書きは Windows ネイティブでは動かないため、scripts への一本化はこの意味でも必要
- 「README 更新方針」の「実ファイル用ライブラリの置き場所例は WSL 前提で書く」は見直しが必要。Windows ネイティブでのデバッグも予定されているため、`MIMIMILLI_ROOT_FOLDER` の例は WSL パス（`/mnt/c/...`）と Windows パス（`C:\Users\...`）を併記する。Phase 4 実装時も両形式のパスを受け付けることを要件に含め、`realpathSync` による正規化が Windows パスで期待どおり動くかを確認する
- 同一チェックアウトを WSL と Windows の両方から使う場合、better-sqlite3 などのネイティブモジュールがプラットフォーム間で衝突するため、node_modules を共有できない。環境ごとに別クローンにするか `pnpm install` をやり直す運用になる点を README に注記しておくとよい
- `dev:real` 一括起動では server 起動完了前に client がリクエストしうるが、Vite proxy は接続を都度張るためリロードで回復する。実害は小さいので対処不要、README に一言あれば十分
- `dev:real:client` の `BACKEND_URL=http://localhost:8080` は server の `PORT` デフォルトと暗黙に対になっている。`PORT` を変える運用が出てきたら壊れるが、現時点では注記に留めてよい

### 結論への意見

「短期 Phase 1 + 2、中期 Phase 3」という段階分けに異論はないが、上記のとおり Phase 1 は互換エイリアスを残さない一括リネームに、Phase 3 は `pnpm -r --parallel` 方式にすれば、全 Phase を通して依存追加ゼロ・旧名残しゼロで実施できる。Phase 1〜3 は実質1〜2コミットの作業量なので、まとめて実施してもよい。

## 実装レビュー（2026-07-03）

Codex により Phase 1〜3 + Phase 5 が上記レビューの推奨どおり実装された（互換エイリアスなしの一括リネーム、シナリオ scripts の client 側配置、`pnpm -r --parallel --if-present` による依存追加ゼロの一括起動、`smoke:real` の昇格）。README / HANDOFF の日本語は Sonnet 5 が推敲済み。

### 動作検証の結果（Codex 別エージェントによる実測）

- `pnpm smoke:real`: OK。ルートから exit code 0 で完走。`--filter` 経由で cwd が server に解決されるため、懸念していた cwd 依存（`data/smoke` への相対書き込み）は問題なし
- `pnpm dev:real:server`: OK。起動後約2秒で `/api/works` が 200 応答（root 未設定時は空一覧を返し、起動は成功する現状挙動どおり）
- `dev:real` の自己再帰: なし。pnpm-workspace.yaml はルートを含まず `.npmrc` に include-workspace-root 系設定なし。root と server の両方に存在する `smoke:real` を `pnpm -r --parallel --if-present run` で流す実測でも、root 側は対象外だった
- fixture シナリオ scripts: 参照整合性は全一致（ルート scripts が指す client/server 側 script はすべて存在、env 代入は client の cross-env に閉じている）。実地起動はポート1355が別セッションの dev サーバーで使用中のためスキップ
- `pnpm check` / `pnpm test`: いずれも全パス（server 73 / client 73）

### 残った軽微な指摘

- server の `dev` と `dev:real` が同一コマンドの重複定義。現状は許容範囲だが、将来 `dev` 側だけ変更すると乖離するリスクがあるため、変更時は両方を意識すること
- Phase 4（`MIMIMILLI_ROOT_FOLDER`）は提案どおり未実施。別 issue として扱う

## 実施記録（2026-07-03）

Fable レビューを採用し、Phase 1〜3 と `smoke:real` 昇格をまとめて実施した。
依存追加はしていない。

### 実装内容

- ルート `package.json`
  - `dev` を `dev:fixture` のエイリアスに変更
  - `dev:fixture` / `dev:fixture:new-work` / `dev:fixture:empty` / `dev:fixture:errors` を追加
  - `dev:real` を `pnpm -r --parallel --if-present run dev:real` に変更し、server + client の一括起動にした
  - `dev:real:server` / `dev:real:client` を追加
  - 旧 `dev:server` は削除
  - `smoke:real` を追加
- `client/package.json`
  - `dev:new-work` / `dev:empty` / `dev:errors` を追加
  - env 代入は既存方針どおり `cross-env` に閉じ込め、ルート scripts には OS 依存の `VAR=value` を置かない形にした
- `server/package.json`
  - `dev:real` を追加（`dev` と同じ `node --watch src/index.ts`）
  - `smoke:real` を追加（`node tests/helpers/smoke.ts`）
- `README.md`
  - `MIMIMILLI_MOCK_SCENARIO=... pnpm dev` の案内を `dev:fixture:*` に置換
  - real アダプタの案内を `pnpm dev:real` 一括起動中心に更新
  - 分離起動用に `dev:real:server` / `dev:real:client` を記載
  - server 起動前の client 接続失敗はリロードで回復する旨、`PORT` 変更時は `BACKEND_URL` も合わせる旨を追記
  - WSL と Windows ネイティブで `node_modules` を共有できない注意を追記
- `docs/HANDOFF.md`
  - 実務用コマンド一覧を新 scripts に更新

### 採用しなかった範囲

- `MIMIMILLI_ROOT_FOLDER` は未実装。
  settings への副作用を持つ新挙動なので、別 issue / 別コミットで扱う。
- mimikago から mimimilli への名称変更は未実施。
  パッケージ名、portless 名、URL、ドキュメント表記に広く影響するため、別コミットで扱う。

### 検証

- `jq` で root / client / server の `package.json` が妥当な JSON として読めることを確認
- `pnpm --filter @mimimilli/server smoke:real` で real smoke が成功することを確認
- `pnpm check` で型チェックが成功することを確認
