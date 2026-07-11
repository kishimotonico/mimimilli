# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止

## 注意事項

- 仕様・設計ドキュメントは `docs/` に適宜整理する。全体の地図は `docs/README.md`
- ADRを `docs/adr/` に保存する
- タスク管理は Backlog.md CLI（`pnpm backlog` コマンド、`backlog/` ディレクトリ）に一元化する。残タスク・実装計画・作業メモはタスクに集約し、HANDOFF や他の docs に残タスクリストを分散させない
- タスクにするのは「検証可能な受け入れ条件が書けて、1〜数PRで完結する見通しがある」ものだけ。要件が未定・ふんわりしたものはドラフト（`pnpm backlog draft`）に置き、着手を決めたらまず「要件を決める」タスクを切る
- `docs/issues/` は過去の作業記録アーカイブ（2026-07-06 凍結）。新規追加・編集はしない
- メンテナンス対象のドキュメント（HANDOFF・docs/README 等）は追記で積み上げず、書き換え・削除で「現在の状態」だけを保つ。時系列の経緯は Git 履歴と backlog のタスクに任せる

## 実装方針

- 過度なフォールバックは禁止。エラーは正しくハンドリングし、問題を隠蔽しないこと
- 互換性は重視しないため、破壊的変更もOK。適切な設計・実装を重視する
- 既存仕様や要件も柔軟に変更OK。必要に応じて仕様を見直し、より良い設計を追求する
- 場当たり的、その場しのぎの修正は禁止。工数がかかっても本質的に改善する
- フロントエンド（`client/`）の見た目・操作系を触るときは `docs/design-system.md` の規約（カラートークン・テーマ・z-index・motion 等）に従う。レイアウトの正は実装
- 共通のDefinition of Doneは、typecheck・lint・fmt:check・テストがすべて通ること。該当する変更では `pnpm check` と `pnpm test` を確認する

## デバッグ方法

- ブラウザを使ったデバッグは agent-browser を使う。それ以外は必要なときのみ
- 開発サーバーは別のシェルで起動済みのことが多いので、`pnpm dev`を実行せず直接アクセスしてOK
- アクセスURLは `http://mimi.localhost:1355`（`client/package.json` の `portless run --name mimi` 由来）。IPアドレスによるアクセスは不可
- agent-browser は他セッションとブラウザを共有してタブを奪われることがあるため、`--session <名前>` を付けて専用セッションで操作する

<!-- BACKLOG.MD GUIDELINES START -->

## タスク管理（Backlog.md CLI）

- タスクの参照・作成・更新は `pnpm backlog` CLI で行う。`backlog/` 配下のMarkdown直接編集は禁止（メタデータが壊れる）
- 一覧: `pnpm backlog task list --plain`、詳細: `pnpm backlog task view <id> --plain`、検索: `pnpm backlog search "<語>" --plain`
- タスクの作成・着手・完了の前に、対応するガイドを読む: `pnpm backlog instructions task-creation | task-execution | task-finalization`
- 迷ったら `pnpm backlog <コマンド> --help`
<!-- BACKLOG.MD GUIDELINES END -->
