---
id: TASK-89
title: ID移行高速経路のsize/mtime判定を内容ハッシュで補強する
status: To Do
assignee: []
created_date: '2026-07-24 13:17'
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
