# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止

## 注意事項

- 仕様・設計ドキュメントは `docs/` に適宜整理する。全体の地図は `docs/README.md`
- ADRを `docs/adr/` に保存する
- タスク管理は Backlog.md CLI（`backlog` コマンド、`backlog/` ディレクトリ）に一元化する。残タスク・実装計画・作業メモはタスクに集約し、HANDOFF や他の docs に残タスクリストを分散させない
- `docs/issues/` は過去の作業記録アーカイブ（2026-07-06 凍結）。新規追加・編集はしない
- メンテナンス対象のドキュメント（HANDOFF・docs/README 等）は追記で積み上げず、書き換え・削除で「現在の状態」だけを保つ。時系列の経緯は Git 履歴と backlog のタスクに任せる

## 実装方針

- 過度なフォールバックは禁止。エラーは正しくハンドリングし、問題を隠蔽しないこと
- 互換性は重視しないため、破壊的変更もOK。適切な設計・実装を重視する
- 既存仕様や要件も柔軟に変更OK。必要に応じて仕様を見直し、より良い設計を追求する
- 場当たり的、その場しのぎの修正は禁止。工数がかかっても本質的に改善する
- フロントエンド（`client/`）の見た目・操作系を触るときは `docs/design-system.md` の規約（カラートークン・テーマ・z-index・motion 等）に従う。レイアウトの正は実装

## デバッグ方法

- ブラウザを使ったデバッグは agent-browser を使う。それ以外は必要なときのみ
- 開発サーバーは別のシェルで起動済みのことが多いので、`pnpm dev`を実行せず直接アクセスしてOK
- アクセスURLは `http://mimi.localhost:1355`（`client/package.json` の `portless run --name mimi` 由来）。IPアドレスによるアクセスは不可
- agent-browser は他セッションとブラウザを共有してタブを奪われることがあるため、`--session <名前>` を付けて専用セッションで操作する

<!-- BACKLOG.MD GUIDELINES START -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:
- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
