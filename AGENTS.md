# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止。プッシュは人間がやる
- 中規模以上のタスクは統合ブランチ（`feat/〜`）に作業ブランチを集約し、全タスク完了時に最終レビューを経てmasterへマージする。統合ブランチのマージは最後の1回のみ

## ドキュメント運用

- ドキュメントは `docs/` に整理する。全体像は `docs/README.md`
- ADRは `docs/adr/`
- ドキュメントは追記で積み上げず、書き換え・削除で現在の状態を保つ。経緯はGit履歴・ADR・backlogに任せる

## 実装方針

- コード品質を重視する。破壊的な変更、既存仕様の変更も可能。より良い設計を追求する
- 後方互換性を維持しないこと。互換レイヤーやフォールバック、移行処理の追加はしない。移行が必要なら手動コマンド例をADRに残し、ユーザーが実行する
- 短期的解決ではなく、長期的視点での解決を優先する。パッチワーク的な修正は禁止
- リスクや開発コストを判断根拠にしない。適した設計・実装を優先する
- コメントは最小限に。経緯を書かない
- UIの実装は `docs/design-system.md` を参考にする。レイアウトの正は実装

## 検証・テストの運用

- 実装中は変更範囲のテストのみ。フルの `pnpm check && pnpm test` はタスク完了時に1回
- テストは網羅性より実行速度。低価値なテストは削ってよい
- 失敗しているテストを放置しない。直すか、その場で起票する
- `pnpm test:smoke` はUI・レイアウト変更時に実行し、結果を受け入れ条件に含める

## マルチエージェント運用

- 統括担当は要件整理・分解・委任・進行管理・統合・コミット判断に専念し、原則、コード編集・テスト実行・ブラウザ操作をしない
- 委譲時は表示内容・文言・既存UIとの整合まで決めた仕様を渡す
- 実装担当は担当範囲内でさらに委任・並列化してよい。成果は統括へ一括報告する
- 検証担当は問題を証拠付きで統括へ報告する。修正しない
- 1タスク1worktreeが基本。統括が `git worktree add .worktrees/<タスクID>` で専用ブランチを用意して渡し、統合もマージで行う。worktreeごとに `pnpm install` する
- レビュー担当（Sonnet）を常設し、コミット前に「報告にない副作用」だけをレビューする
- 実装担当は受け入れ条件を満たすたび `pnpm backlog task edit <id> --check-ac <n>` でチェックし、完了時はテキストで報告する。統括はpollingしない
- Claude Code: 総括 Fable or Opus / 実装 Sonnet or Cursor（UI・デザイン系はSonnet、ロジック中心はCursor）/ 検証・レビュー Sonnet
- Codex: 総括 Sol / 実装 Terra or Cursor / 検証・レビュー Luna

## デバッグ方法

- ブラウザデバッグはagent-browserを使い、`--session <name>` で専用セッションを分ける
- 開発サーバーはだいたい起動中なので `pnpm dev` せず `http://[<ブランチ名>.]mimi.localhost:1355` へ（IPアドレス不可）
- worktreeではルートで `pnpm dev:fixture:new-work` を起動して確認する
- 実データDBで検証しない。書き込みを伴う検証はフィクスチャアダプタ（`dev:fixture:new-work` 等のモックシナリオ）で行う

<!-- BACKLOG.MD GUIDELINES START -->

## タスク管理（Backlog.md CLI）

- タスクの参照・作成・更新は `pnpm backlog` CLI で行う。`backlog/` 配下のMarkdown直接編集は禁止（メタデータが壊れる）
- 一覧: `pnpm backlog task list --plain`、詳細: `pnpm backlog task view <id> --plain`、検索: `pnpm backlog search "<語>" --plain`
- タスクの作成・着手・完了の前に、対応するガイドを読む: `pnpm backlog instructions task-creation | task-execution | task-finalization`
- 迷ったら `pnpm backlog <コマンド> --help`
<!-- BACKLOG.MD GUIDELINES END -->
- 残タスク・実装計画・作業メモはbacklogのタスクに集約し、docsへ分散させない
- タスクにするのは検証可能な受け入れ条件が書けるものだけ。要件未定はドラフト（`pnpm backlog draft`）へ
- 受け入れ条件は7項目程度まで。超えるならタスクを分割する
