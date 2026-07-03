# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止

## 注意事項

- 仕様・設計ドキュメントは `docs/` に適宜整理する。全体の地図は `docs/README.md`
- ADRを `docs/adr/` に保存する
- Claude CodeやCodexは `docs/issues/yyyy-mm-dd-summary-description.md` に作業内容を読み書きする
  - 本文2行目に `Status: done | wip | todo | note` 行を置き、`docs/issues/README.md` の一覧表にも1行足す
- 未完了タスクは `docs/BACKLOG.md` に一元管理する（HANDOFF や issue に残タスクリストを分散させない）
- メンテナンス対象のドキュメント（HANDOFF・BACKLOG・docs/README 等）は追記で積み上げず、書き換え・削除で「現在の状態」だけを保つ。時系列の経緯は docs/issues/ と Git 履歴に任せる

## 実装方針

- 過度なフォールバックは禁止。エラーは正しくハンドリングし、問題を隠蔽しないこと
- 互換性は重視しないため、破壊的変更もOK。適切な設計・実装を重視する
- 既存仕様や要件も柔軟に変更OK。必要に応じて仕様を見直し、より良い設計を追求する
- 場当たり的、その場しのぎの修正は禁止。工数がかかっても本質的に改善する
- フロントエンド（`client/`）の見た目・操作系を触るときは mimimilli デザイン正典（`docs/design_handoff_mimimilli_library/README.md`）に従う（カラートークン・テーマ・オーバーレイ・motion・カーソル等の規約）

## デバッグ方法

- ブラウザを使ったデバッグは agent-browser を使う。それ以外は必要なときのみ
- 開発サーバーは別のシェルで起動済みのことが多いので、`pnpm dev`を実行せず直接アクセスしてOK
- アクセスURLは `http://mimi.localhost:1355`（`client/package.json` の `portless run --name mimi` 由来）。IPアドレスによるアクセスは不可
- agent-browser は他セッションとブラウザを共有してタブを奪われることがあるため、`--session <名前>` を付けて専用セッションで操作する
