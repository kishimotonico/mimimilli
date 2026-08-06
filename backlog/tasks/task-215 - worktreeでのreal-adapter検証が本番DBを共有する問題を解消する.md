---
id: TASK-215
title: worktreeでのreal adapter検証が本番DBを共有する問題を解消する
status: To Do
assignee: []
created_date: '2026-08-06 15:43'
labels: []
dependencies: []
priority: high
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
git worktree で pnpm dev:real を実行すると、MIMIMILLI_DATA_DIR が未設定のときのデフォルト挙動により、メインの作業ディレクトリの dev:real サーバーと同一の ~/.local/share/mimimilli データベースを共有する。

portless のワークツリープレフィックスにより URL は別サブドメインへ分離されるが、DB は分離されない。そのため worktree 上で real adapter を使った検証（作品の登録・タグ編集・スキャン・DLsite 連携など書き込みを伴う操作）を行うと、実際に使っているライブラリのデータを壊しうる。

このプロジェクトはタスクを worktree 単位で並行して進める運用をしており、検証担当が worktree 上で実機確認を行う場面が多い。実際に TASK-205/206 の検証時に、この共有に気づいた検証担当が「ユーザーの実ライブラリデータを壊すリスクを避けて」DLsite 一括取得の実機再現を見送る、という判断をしている。安全のために検証が省略されるのは本末転倒なので、構造的に分離したい。

方向性: worktree で起動したときにデータディレクトリが自動的に分離される、あるいは本番データディレクトリを使う場合に明示的な指定を要求する。誤って本番を掴む方をデフォルトにしない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 worktree で dev:real を起動したとき、メイン作業ディレクトリとは別のデータディレクトリが使われる
- [ ] #2 本番のデータディレクトリを worktree から使いたい場合は、明示的な指定が必要になっている
- [ ] #3 メイン作業ディレクトリでの起動時の挙動が従来と変わらない
- [ ] #4 分離の仕組みが docs に記載され、worktree で検証する際の手順が読み取れる
<!-- AC:END -->
