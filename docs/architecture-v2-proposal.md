# mimimilli アーキテクチャ v2 提案

> ステータス: 承認（2026-06-11）。決定記録は [ADR-0001](adr/0001-typescript-api-server.md) / [ADR-0002](adr/0002-mock-as-fixture-adapter.md)。本文書は設計の基準ドキュメントとして維持する。
> 旧提案 `docs/web-architecture-proposal.md`（Tauri廃止・axumサーバー化）は本文書が置き換え、2026-07-03 に削除済み（Git履歴参照）。

## 1. 結論

- フロントエンドは現行どおり **React 19 + Vite の SPA** を本線とする（変更なし）
- API サーバーは Rust(axum) 資産を引き継がず、**TypeScript（Hono + Node）で新規開発**する
- API 契約の正典は **`client/mocks/` のモック実装から昇格させた共有スキーマ（Zod）** とし、モックと本実装で同じルーター・同じ型を共有する
- リポジトリは pnpm workspace のモノレポ（`client/` / `server/` / `shared/`）に再編する

一言でいうと、「モックを捨てて本実装を書く」のではなく、**モックを本実装の fixture アダプタへ昇格させる**構成にする。

## 2. 現状認識

### 2.1 いま起きていること

- フロントエンドは mimimilli デザイン正典をベースに、feature-first 構成（app → features → entities → shared、TanStack Query + Jotai）へ整理済み。モックを作り込みながら UX と仕様を詰めるフェーズ
- `client/mocks/`（fixtures + handlers、計1200行超）が事実上の API 契約になっている。`/api/fs`（物理FSブラウズ）や軸ファセット・スマートフォルダーなど、**Rust server に存在しないエンドポイントがモック側で先行**している
- Filesモード（物理FSファイラー）が実装に入っており、要件 v4 で「フェーズ2以降」とした File Explorer が実質前倒しになっている
- `server/`（Rust/axum、約4000行）は Tauri 時代のサービス層を HTTP 化したもの。動作はするが新スコープ（軸ファセット・タグAND・スマートフォルダー・/fs）を持たず、最近の開発から取り残されている

### 2.2 このアプリの技術的性質

- ローカルファイルシステムと強く連動する常駐 Web システム（走査・`.meta.json` 読み書き・メディア配信）
- 負荷特性はほぼ **I/O バウンド**。数千作品 × 数十タグ規模で、SQLite + 適切なインデックスで足りる
- 計算負荷の高い処理（音声デコード等）はブラウザ側（HTML5 Audio / Web Audio）が担う
- 将来は LAN 内の別端末からのストリーミング（Range 対応、認証）へ伸ばす

## 3. サーバー実装言語の再選定

旧提案では「既存 Rust 資産の流用」を主な理由に Rust を第一候補としていた。今回、Tauri 遺産を重視しない・一からの API 開発も可とする前提で再評価する。

### 3.1 TypeScript を推す理由

1. **API 契約の正典がすでに TypeScript にある。** `client/mocks/handlers/` と `src/features/*/api.ts`・`entities/work/model.ts` が現行仕様そのもの。実装言語を揃えれば契約→実装の距離が最短になり、型を二重定義（TS と serde モデル）する必要がなくなる
2. **モックと本実装を一本化できる。** ルーターとドメインロジックを共有し、差し替えるのは「fixture アダプタ ↔ 実FS+SQLite アダプタ」だけにできる。モック駆動で UI を作り込む現在の開発スタイルがそのまま本実装の開発スタイルになり、二重実装・契約乖離が構造的に起きなくなる
3. **開発体制に合う。** 一人＋AIエージェントで UI と API を高頻度に行き来する開発では、単一言語・単一ツールチェーンの効果が大きい。特にエージェントが API 契約を取り違えた場合、共有スキーマがあれば `tsc` が機械的に検出する（TS/Rust の2言語構成では契約のズレは結合テストか実行時まで露見しない）。Rust のビルド時間（Raspberry Pi では初回30分超）も解消する
4. **要件に対して Rust の強みが決定打にならない。** I/O バウンド・数千作品規模では Node で性能上の問題は生じない。ファイル走査・SQLite・Range 配信・スクレイピングはいずれも Node エコシステムが成熟している

### 3.2 Rust 継続案を採らない理由

- 新スコープ（軸ファセット・スマートフォルダー・/fs）はどのみち新規実装で、「流用できる資産」は実際にはスキャナーと DLsite スクレイパーの仕様知識が中心。これはコードではなくドキュメント（本文書 §8）として吸い上げれば足りる
- フロントの契約（TS型）とサーバーモデル（serde）の二重管理が恒常コストになる
- ギャップレス再生など将来「Rust が欲しくなる」処理は、そのときに限定的なサイドカー（別プロセス/wasm）として足せばよく、API サーバー全体を Rust にする理由にはならない

### 3.3 ランタイムとフレームワーク

- フレームワークは **Hono** を採用する。ランタイム非依存（Node / Bun 両対応）で、Vite の dev middleware として Hono アプリをマウントできるため、`pnpm dev` だけで動く現在の DX を維持できる（§5.3）
- 配布は **Bun（`bun build --compile` による単一 exe）を本線**とする（§7）。開発ランタイムは Node / Bun のどちらでもよいが、配布形態を踏まえ**ネイティブモジュールへの依存は避ける**（SQLite は `bun:sqlite` / `better-sqlite3` を Drizzle 経由で切り替え、ファイル監視は chokidar v4、音声メタデータは music-metadata と、いずれも pure JS で揃う）

### 3.4 負荷面の検証（CPUバウンド処理は本当にないか）

言語選定の前提となる「重い処理がない」ことの確認。

- **音声配信:** サーバーはデコード・変換をせず、ファイルの指定区間をソケットへ流すだけ（I/O バウンド）。データ量も無圧縮 WAV で約172KB/s と、ループバック／LAN 帯域の0.1%台。将来のマルチch同時再生でも余裕がある。オンザフライ変換が必要になった場合も ffmpeg サブプロセスに委譲するため、サーバー言語の選択に影響しない
- **ファイル追跡:** 移動追従は `.meta.json` 内の UUID による突合で成立する設計のため、**コンテンツハッシュは不要**。仮に重複検出等でハッシュが必要になっても、Node/Bun の crypto はネイティブ実装（1コアあたり GB/s 級）で、実際の律速はディスク読み込み
- **最も重い処理は初回スキャン時の再生時間取得。** music-metadata はヘッダー解析のみで通常は数KB/ファイルだが、Xing ヘッダーのない VBR MP3 のみ全フレーム走査が要る。DB にキャッシュして初回限り＋並列化で対応し、これも本質は I/O バウンド
- 将来 CPU バウンドな機能（波形生成・ラウドネス解析等）が必要になった場合は、ffmpeg サブプロセスまたはその機能に限定したネイティブアドオン／サイドカーで対応できる。アーキテクチャ全体の言語選定には波及しない

## 4. 全体構成

```text
Browser (React SPA)
  │  HTTP / SSE
  ▼
API Server (Hono + Node)
  ├─ routes/        … HTTP 層（薄い）
  ├─ core/          … ドメイン: scanner / meta.json / tag / smart-folder 評価
  └─ adapters/
       ├─ real:     SQLite (better-sqlite3) + 実ファイルシステム
       └─ fixture:  インメモリ fixtures（現 client/mocks/fixtures を移設）
            ▲
            └─ Vite dev / Playwright visual test がこちらを使う
```

### 4.1 リポジトリ構成

```text
mimimilli/
├── pnpm-workspace.yaml      # ルートに移設（現在は client/ 内にある）
├── client/                  # React SPA（現行のまま）
├── server/                  # TypeScript API サーバー（新規。Rust を置き換え）
│   └── src/
│       ├── index.ts         # エントリ（@hono/node-server）
│       ├── app.ts           # Hono アプリ組み立て・アダプタ注入
│       ├── routes/          # settings / scan / works / axes / smart-folders / fs / media
│       ├── core/            # scanner, meta, tags, smartFolderEval, dlsite
│       └── adapters/        # real（sqlite + fs）/ fixture（インメモリ）
├── shared/                  # API 契約: Zod スキーマ + 型（client / server 双方が依存）
└── docs/
```

先日 `apps/*` からフラット構成へ再編したばかりなので、`apps/` には戻さずフラットのまま workspace 化する。

### 4.2 各パッケージの責務

- `shared/`: エンドポイントごとのリクエスト/レスポンス Zod スキーマと、`Work` / `WorkSummary` / `FsListing` / `SmartFolder` などのドメイン型。`.meta.json` のスキーマもここに置き、パース・バリデーションを一元化する
- `server/`: ルーター＋ドメインロジック＋アダプタ。境界は「データの出どころ」（fixture か 実FS+SQLite か）にだけ置き、過剰なレイヤリングはしない
- `client/`: 現行構成を維持。`src/features/*/api.ts` の戻り値型を `shared/` からの import に差し替える。`client/mocks/` は server の fixture アダプタへ吸収されて消える

### 4.3 状態の置き場所（現行方針を踏襲）

- `.meta.json` = Source of Truth、SQLite = 検索用キャッシュ＋DB固有情報（レジューム・ブックマーク・スマートフォルダー・プリセット）— 変更なし
- DB アクセスは Drizzle ORM で抽象化し、ドライバーはランタイムに応じて `bun:sqlite`（Bun・配布ビルド）/ `better-sqlite3`（Node）を切り替える。スキーマ定義とマイグレーションを TS で持てる。素の SQL で書きたい箇所はそのまま書いてよい
- 音声メタデータ（再生時間・チャプター）は `music-metadata`（pure JS）を第一候補にし、ffprobe 必須の前提を外す。読めないフォーマットだけ ffprobe にフォールバック

## 5. API 契約 v2

### 5.1 方針

- 契約の出発点は現行モックが実装している面とする（フロントは既にこれで動いている）
- ただし新規開発の機会に、パス体系の不揃い（`/api/works` と `/api/library/axes` の混在、メディア系の `/api/audio` `/api/files` `/api/works/:id/cover` の分散）を一度だけ整理する
- 一覧系は最初から **ページング（`page` / `limit`、レスポンスに `total`）** を契約に含める。現行モックは全件返しで、ここが将来の作り直しポイントになるため

### 5.2 エンドポイント一覧

```text
設定・スキャン
  GET  /api/settings
  PUT  /api/settings
  POST /api/scan                  # 開始のみ返す（202）
  GET  /api/scan/events           # SSE: 進捗・完了サマリー

作品・検索
  GET  /api/works                 # q, tags(AND), axis, axisValue, view, sort, page, limit
  GET  /api/works/:id
  PATCH /api/works/:id            # title / tags / bookmarked をまとめて部分更新
  POST /api/works/:id/resume      # 再生位置（高頻度なので分離）
  POST /api/works/:id/last-played

分類軸・スマートフォルダー・プリセット
  GET  /api/axes/:axis            # circle / cv / series / category / tag / added — 値一覧+件数
  GET  /api/smart-folders
  POST /api/smart-folders
  PUT  /api/smart-folders/:id
  DELETE /api/smart-folders/:id
  GET  /api/smart-folders/:id/works
  GET/POST/DELETE /api/presets

物理ファイルシステム（Filesモード）
  GET  /api/fs?path=...           # 1階層列挙。FsListing（workId / workRelPath 付き）

メディア配信
  GET  /api/media/cover/:id
  GET  /api/media/audio/:id/*path # Range 対応必須
  GET  /api/media/file/:id/*path

DLsite 連携
  POST /api/dlsite/:id/fetch
  POST /api/dlsite/:id/apply
```

タグ更新 PUT・タイトル更新 PUT・ブックマーク POST は `PATCH /api/works/:id` に統合する。`searchWorks`（v1）と `searchWorksV2` の重複もこの機会に v2 系へ一本化する。

### 5.3 モック＝fixture アダプタの開発フロー

- `client/vite.config.ts` は `BACKEND_URL` 未指定時、workspace 依存で `server` の Hono アプリ（fixture アダプタ注入）を dev middleware としてマウントする。`pnpm dev` 一発で動く DX は維持
- `MIMIMILLI_MOCK_SCENARIO`（default / empty / new-work / errors …）は fixture アダプタのシナリオとしてそのまま引き継ぐ
- Playwright ビジュアルテストも fixture アダプタ経由になり、「モックと本番でルーターが違う」ことに起因する回帰が構造的に消える
- 新機能の進め方は今までどおり「fixture で UI を作り込む → 仕様が固まったら real アダプタを実装する」。契約は `shared/` のスキーマが先に固定する

## 6. セキュリティ・配信まわりの要点

- パストラバーサル対策（`realpath` + ルート配下検証）は Rust 版と同水準を必ず移植する。`/api/fs` と `/api/media/*` が対象
- `/api/media/audio` は HTTP Range（206）対応を初版から入れる。シークの体感に直結し、後付けより安い
- サーバーの bind は当面 `127.0.0.1` 固定。LAN 公開（iPad 等）はトークン認証とセットでフェーズを切る（要件 v4 §9 のスコープ）

## 7. 配布形態（Windows）

最終形は「インストーラーで導入すると、Web サーバーが常駐起動してブラウザでアプリが開く」手軽なローカルアプリとする。

- サーバーは `bun build --compile` で依存込みの単一 exe にし、Inno Setup / MSI 等のインストーラーで配布する。§3.3 のネイティブモジュール回避方針はこのための前提
- bind は `127.0.0.1` の固定ポート（衝突時のみずらす）。ブックマーク可能な URL を維持する
- 常駐（システムトレイ）化・自動起動・シングルインスタンス制御などの「ガワ」はサーバー本体と別コンポーネントとして薄く作れることを確認済み。**詳細設計は基本機能の完成後に行う**（本文書では方向性のみ記す）
- 未署名 exe はアンチウイルスに誤検知される場合がある。配布を広げる段階でコード署名を検討する

## 8. Rust 資産の扱い

- `server/`（Rust）は v2 サーバーが同等機能に達した時点で削除する。それまでは参照実装として残す
- コードではなく**仕様**として吸い上げるもの:
  - スキャンフロー: mark_all_missing → 走査 → mark_found（ブックマーク・レジューム保持）→ `.meta.json` 自動生成 → IDベース移動追従 → 残った missing が行方不明
  - `.meta.json` 自動生成規則（タイトル=フォルダー名、RJコード認識、最多ファイルのサブフォルダーを default プレイリストに）
  - DLsite スクレイピングのセレクタ（HANDOFF.md に記録済み）と Cookie（`adultchecked=1`）
- DB スキーマ（works / tags / work_tags / app_settings / search_presets ＋ 新規 smart_folders）は v2 で再定義する。DB はキャッシュなので互換マイグレーションは不要、再スキャンで再構築する

## 9. 段階的移行プラン

1. **契約確定:** `shared/` パッケージ新設。現行モック＋ §5.2 の整理を反映した Zod スキーマを定義し、client の `api.ts` 群を共有型へ差し替え。workspace をルートに再編
2. **server 骨格 + fixture アダプタ:** Hono アプリと routes を実装し、`client/mocks/` の fixtures・シナリオを fixture アダプタとして移植。Vite dev middleware 接続を切り替え、`client/mocks/` を削除。ビジュアルテストが通ることを確認
3. **real アダプタ:** SQLite（Drizzle）＋ scanner ＋ `.meta.json` 読み書き ＋ メディア配信（Range）。Rust 版と機能同等になった時点で `server/`（Rust）を削除
4. **体験改善:** SSE スキャン進捗、DLsite 連携、`/api/fs` の実FS実装の磨き込み、ページング有効化
5. **将来:** ファイル監視（chokidar v4）、LAN 公開＋認証、配布（§7: Bun compile 単一 exe ＋ インストーラー ＋ トレイ常駐）

ステップ1〜2が終わると「モックで UI を作る」体制が崩れないまま、いつでも real アダプタを差せる状態になる。フロントのモック作り込みと並行して進められる。

## 10. 合わせて見直すべきこと

> 注記（2026-07-03）: 本節の指摘は解消済み（3 のフェーズ再編は実装完了により実質不要となった）。提案当時の記録として残す。

アーキテクチャ以外で、今の段階でズレているもの。

1. **`docs/frontend-design.md` が存在しない。** AGENTS.md がフロント作業時の必読として参照しているが未作成。mimimilli 正典・tokens.css・motion 等の規約を実際に書き起こすか、参照を `docs/design_handoff_mimimilli_library/README.md` へ修正する
2. **AGENTS.md の記述ズレ:** フロントを `apps/web` と記載（実際は `client/`）。アクセスURLが `asa.localhost:1355` だが、`client/package.json` の portless 名は `mimi`（docs/README も `mimi.localhost`）。どちらが現用か確認して統一する
3. **requirements-v4 とフェーズ計画の乖離:** File Explorer（Filesモード）はフェーズ2扱いのまま実装が先行している。物理FSファイラーとしての再設計（`/api/fs`、受動スタック等）を要件に反映し、フェーズを切り直す
4. **README / HANDOFF / DEVELOPMENT の鮮度:** 技術スタック表・エンドポイント一覧が Rust server 前提。v2 確定のタイミングでまとめて更新する（中途半端に直すより一括が良い）
5. **ページング:** モックも `searchWorksV2` も全件返し。§5.2 のとおり契約に先に入れておく
6. **ADR:** 本提案の承認に伴い ADR-0001（API サーバーを TypeScript で新規開発）、ADR-0002（モック＝fixture アダプタ方式）を起票済み
