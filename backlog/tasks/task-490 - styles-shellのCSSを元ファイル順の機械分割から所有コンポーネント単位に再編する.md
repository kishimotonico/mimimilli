---
id: TASK-490
title: styles/shellのCSSを元ファイル順の機械分割から所有コンポーネント単位に再編する
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:47'
updated_date: '2026-10-08 06:12'
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
- [x] #1 shellのCSSファイルが所有コンポーネント単位で名付けられ、a/b/c形式の分割が無い
- [x] #2 読み込み順に依存した同詳細度ルールの上書きが無い（依存が残る箇所は詳細度かレイヤーで明示されている）
- [x] #3 経緯を書いたコメントが無い
- [x] #4 見た目が変わらないことをpnpm test:smokeと主要画面のスクリーンショット比較で確認している
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: library-d.css の値一覧の無効行スタイルの重複はTASK-493で整理するので、493の後に再編する。

意図的に変えた見た目（reduced-motion 時のみ）: 旧 shared-d の一括打ち消しが詳細度で負けて止まっていなかった2件、TopBar の再生中インジケータの点の点滅（.mll-bar__pulse .dot.is-playing）と Files のカラム追加時のスライドイン（.ml-file-col-enter[data-dir]）を、所有ファイル内で同じ詳細度の animation: none にして止めた。通常時の見た目は不変。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
styles/shell を所有コンポーネント単位の40ファイルに再編。ソース順依存は詳細度と同ファイル配置で明示、reduced-motion を所有ファイルごとに置き、打ち消し漏れ2件を修正、参照ゼロの CSS を削除。AC#4 は、主要14画面の再編前後スクリーンショット比較（fixture new-work、1440x757、差分は再生時刻・hover・没入モードのフェード状態のノイズのみ）と smoke 30 通過で確認し、加えてレビューで postcss による全ルール突き合わせ（@media 文脈＋セレクタ＋宣言）を行い意図しない差分なし。個別レビュー＋横断レビュー、master への仮マージで check・test・smoke 全通過。9939fe4d で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
