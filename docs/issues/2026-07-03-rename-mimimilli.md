# mimimilli への名称変更

作成: 2026-07-03 / Codex

## 背景

旧プロジェクト名 `mimikago` を、デザイン正典と画面上のブランド名に合わせて `mimimilli` へ変更する。
リモートリポジトリ名だけは運用上の都合で `mimikago` のまま残す。

## 実施内容

- npm workspace / package 名を `@mimimilli/*` へ変更
  - `mimimilli-workspace`
  - `@mimimilli/client`
  - `@mimimilli/server`
  - `@mimimilli/shared`
- TypeScript import を `@mimimilli/shared` / `@mimimilli/server/*` へ変更
- 環境変数を `MIMIMILLI_*` へ変更
  - `MIMIMILLI_ADAPTER`
  - `MIMIMILLI_DB`
  - `MIMIMILLI_MOCK_SCENARIO`
- real アダプタのデフォルト DB を `data/mimimilli.db` へ変更
- dev URL / portless 名はいったん `mimimilli.localhost` / `--name mimimilli` へ変更したが、同日レビューで「短いURLのままでよい」との判断により `mimi.localhost` / `--name mimi` へ差し戻した（後述）
- localStorage / history state のキーを `mimimilli` プレフィックスへ変更（`mimimilli:playerUiMode` / `mimimilli.navigation.maxIndex` / `__mimimilliNavigation`。コロン・ドットの混在は旧名時代からのもので今回は触れない）
- HTML title / README / HANDOFF / AGENTS / 設計ドキュメントの表記を `mimimilli` へ変更
- 旧 Rust server の crate 名・ログ・DB 名も `mimimilli-server` / `mimimilli.db` へ変更
- `pnpm install --offline` で workspace symlink と lockfile の整合を確認

## 対象外

- リモートリポジトリ名は変更しない。
  README の clone 例は `git clone <repository-url> mimimilli` として、リモート名に依存せずローカルディレクトリ名を指定する形にした。
- 既存ユーザーの `mimikago.db` や localStorage キーの移行処理は入れていない。
  互換性より設計整理を優先する方針に合わせ、破壊的変更として扱う。

## 検証

- `rg` で `mimikago` / `MIMIKAGO` / `@mimikago` の残存が、本作業記録内の旧名説明を除いてないことを確認
- `pnpm install --offline`: 成功
- `pnpm check`: 成功
- `pnpm test`: 成功
- `pnpm smoke:real`: 成功
- `pnpm --filter @mimimilli/client build`: 成功
- `cargo check`（server-rust）: 成功

## Claude レビュー（2026-07-03）

Codex に旧名残存・表記ゆれ・lockfile 整合の調査を依頼し、差分全体を確認した。パッケージ名・import・環境変数・URL・ストレージキーの置換は一貫しており、lockfile も整合。過剰置換が2件見つかり修正した。

- `docs/issues/2026-07-03-dev-command-real-audio-proposal.md`: 歴史的記録の「mimikago から mimimilli への名称変更は未実施」が「mimimilli から mimimilli」になっていたため原文へ復元
- `docs/architecture-v2-proposal.md` §10-2: 当時の AGENTS.md のズレを記録した文中の `mimi.localhost` だけが置換され、同文の portless 名 `mimi` と矛盾していたため原文へ復元

あわせて `server/src/index.ts` の env コメントの桁揃え（名称が1文字伸びたことによるズレ）と、HANDOFF のツリー図の桁を修正した。

## dev URL の差し戻し（2026-07-03）

コミット後のレビューで「開発URLは元の短いものでよい」との判断になり、dev URL と portless 名のみ `mimi.localhost:1355` / `--name mimi` へ差し戻した。対象は `client/package.json` の scripts、AGENTS.md、README、HANDOFF、および歴史的記録（2026-06-12 レビュー issue）の原文復元。パッケージ名・環境変数・DB名・ブランド表記は `mimimilli` のまま。
