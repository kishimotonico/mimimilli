---
id: TASK-498
title: fixtureの登録プレビュー規則をrealと共通にし、未設定rootのフォールバックを撤去する
status: To Do
assignee: []
created_date: '2026-10-02 11:48'
updated_date: '2026-10-04 09:34'
labels:
  - server
  - fixture
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 556000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
fixtureの getWorkRegisterPreview は独自の正規表現 /RJ\d{6,8}/i でRJコードを検出し、tagsは常に空、orphanedMetaは常にfalseを返す。realは shared の detectRjCode とメタ読み取りで suggestedTitle・tags・orphanedMeta を返す。fixtureには state.rootFolder ?? "/library" が10箇所ほどあり、realの requireRoot（未設定でNotConfiguredError）と挙動が違う（現状のシナリオに未設定rootは無いので到達しない）。プレビューのうち入力から決まる規則（RJ検出・suggestedTitle）をcoreに出して両adapterで共有し、fixtureのroot参照はrealと同じ規則の1関数にする。fixtureの registerScanCandidates が onRegistered を受け取らない件は、登録後のDLsite自動取得の去就（DRAFT-74）で決めるので対象外。どの挙動を両adapter共通の契約テストで縛るかはDRAFT-56とTASK-477の範囲。詳細は doc-6 の srv-arch-2。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 登録プレビューのRJ検出とタイトル候補の規則がcoreの関数で、fixtureとrealが同じ関数を使う
- [ ] #2 fixtureに独自のRJコード正規表現が無い
- [ ] #3 fixtureのroot参照が1関数を通り、未設定時はrealと同じエラーになる
- [ ] #4 登録プレビューの規則が両adapterで同じ結果になることがテストで確認されている
- [ ] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: 登録プレビューのうち、このタスクの範囲は入力から決まる純粋な規則（RJ検出・タイトル候補）だけ。メタの読み込みと配置形式による登録の統合はTASK-481が扱う。
<!-- SECTION:NOTES:END -->
