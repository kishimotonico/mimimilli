---
id: TASK-89
title: ID移行高速経路のsize/mtime判定を内容ハッシュで補強する
status: To Do
assignee: []
created_date: '2026-07-24 13:17'
updated_date: '2026-07-29 18:26'
labels: []
dependencies: []
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-86で導入したID移行完了チェックの高速経路（server/src/adapters/real/metaIdMigration.ts:229-230）は、キャッシュ済みシグネチャの size と mtimeMs が一致すれば本文を読まずに旧IDを再利用する。しかし size+mtime は内容不変の証明ではなく、.meta.json が同一バイト長で書き換えられ、かつ mtime が保持・復元された場合（rsync/tar/cp -p 等のタイムスタンプ保持を伴う外部復元）、新たに生じた重複ID（work/playlist/track）を見逃し、移行を誤って「完了」と報告しうる。Codexレビュー（2026-07-24, master マージ時）でP1として指摘された既知の性能トレードオフ。シグネチャに内容ハッシュ（content fingerprint）等の変更指標を加え、mtime復元でも検知漏れしないようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 verifiedIdSignature が size/mtime に加えて内容由来のフィンガープリント（ハッシュ等）を保持し、高速経路がそれで内容不変を判定する
- [ ] #2 同一バイト長・同一mtimeでIDを差し替えた .meta.json に対し、重複IDが検知される回帰テストが追加されている
- [ ] #3 全件read+parseを避ける高速経路の性能上の意図（TASK-86）は維持されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【TASK-97 との関係（2026-07-30 の棚卸しで判明）】

本タスクが強化しようとしている VerifiedIdSignature は、TASK-97 が削除候補に挙げている機構そのもの。方向が逆なので、着手前に TASK-97 の設計判断を待つこと。

- TASK-97 が署名キャッシュを維持する判断なら、本タスクを実装する
- TASK-97 が廃止する判断なら、その実装がマージされた時点で本タスクを superseded として閉じる

本タスクが指摘している正確性の問題（同一バイト長・同一 mtime で内容を差し替えると重複IDを検知できない）は、署名キャッシュを維持する場合の必須要件として TASK-97 の判断材料に含める。

【AC #3 の記述に矛盾がある】

AC #3 は「全件 read+parse を避ける高速経路の性能上の意図（TASK-86）は維持されている」としているが、内容ハッシュの計算にはファイル本文の read が必要なので、read を避けたまま内容ハッシュを持つことはできない。避けたいのが read なのか JSON parse なのかを区別して書き直すこと。着手時に AC を修正する。

【参照の安定性】

行番号は補助情報とし、VerifiedIdSignature / hasCompleteUniqueIds などの識別子を主参照にすること（長期間 To Do に留まるタスクのため）。
<!-- SECTION:NOTES:END -->
