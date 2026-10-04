---
id: TASK-490
title: styles/shellのCSSを元ファイル順の機械分割から所有コンポーネント単位に再編する
status: To Do
assignee: []
created_date: '2026-10-02 11:47'
updated_date: '2026-10-04 09:35'
labels:
  - client
  - css
  - refactor
dependencies:
  - TASK-473
  - TASK-493
documentation:
  - backlog/docs/doc-7
  - docs/design-system.md
priority: medium
ordinal: 548000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
client/src/styles/shell は library-a〜e・frame-a〜c・files-a〜c・shared-a〜d のように、元の shell.css の記述順を保つために機械的に分割されている。index.css の @import 順もそのためにlibrary/frame/filesが交互に並び、冒頭に経緯コメントがある。library-d.css は888行で軸・行・タグバンド・コラージュ・値一覧・クイックオーバーレイ・ドリルヘッダーを抱える。prefers-reduced-motion も複数ファイルに散っている。TASK-368でplayer-a.cssを所有者単位に分けたのと同じ方法で、同詳細度ルールのソース順依存を洗い出して詳細度かレイヤーで明示し、所有コンポーネント単位（軸レール・作品行・値一覧・クイックオーバーレイ等）のファイルに再編する。mle-/mll- からTailwindへの移行はこのタスクでは扱わない。直書き色の整理（TASK-473）を先に済ませる。詳細は doc-7 の cli-ui-2。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 shellのCSSファイルが所有コンポーネント単位で名付けられ、a/b/c形式の分割が無い
- [ ] #2 読み込み順に依存した同詳細度ルールの上書きが無い（依存が残る箇所は詳細度かレイヤーで明示されている）
- [ ] #3 経緯を書いたコメントが無い
- [ ] #4 見た目が変わらないことをpnpm test:smokeと主要画面のスクリーンショット比較で確認している
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: library-d.css の値一覧の無効行スタイルの重複はTASK-493で整理するので、493の後に再編する。
<!-- SECTION:NOTES:END -->
