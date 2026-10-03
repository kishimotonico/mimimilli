---
id: TASK-482
title: メタファイルの読み込みとパースの入口を1つにし、scan中の重複読み込みと二重パースをなくす
status: To Do
assignee: []
created_date: '2026-10-02 11:46'
labels:
  - server
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 540000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scanRegister.ts の prepareMetaEntries は同じcontentを2回 JSON.parse し、候補IDの抽出も正規表現版を含め3通りある。meta.ts の parseMetaRaw は非公開で、scanRegister は metaFileSchema.safeParse を直接呼ぶためformatVersion判定を通らない。findIdentityConflicts（scanner.ts）や scanMetaStagingRecovery も独自にJSONを読む。readMetaSource（bytes・raw・parsed）を唯一の入口にし、scanは1ファイル1回の読み込みからID・診断・投影入力を取り出す。書き戻し前の再検証のための再読み込みは残してよい。不正JSONでもcandidateIdを拾う現挙動とidentity_conflict判定の整合は設計時に確認する。

TASK-474のメタJSONパース失敗の集約と二重パース解消はこのタスクで扱う。詳細は doc-6 の srv-data-5。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 メタファイルのJSONパースとスキーマ検証の入口が1つで、formatVersion判定を全経路が通る
- [ ] #2 候補IDの正規表現による抽出が無くなっている
- [ ] #3 scanが1つのメタファイルを再検証以外の目的で複数回読まない
- [ ] #4 パース失敗をMetaParseErrorにする処理が1関数にまとまっている
- [ ] #5 不正JSON・不正スキーマ・identity衝突のscan結果が既存テストの期待値どおり
- [ ] #6 pnpm check && pnpm test が通る
<!-- AC:END -->
