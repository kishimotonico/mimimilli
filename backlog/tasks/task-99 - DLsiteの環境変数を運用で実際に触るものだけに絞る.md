---
id: TASK-99
title: DLsiteの環境変数を運用で実際に触るものだけに絞る
status: To Do
assignee: []
created_date: '2026-07-25 23:34'
updated_date: '2026-07-29 18:26'
labels: []
dependencies: []
priority: low
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

DLsite関連の環境変数が13個ある（2026-07-30 に実コードで再確認。起票時は12個だったが TASK-101 で USER_AGENT が追加された）。

MIMIMILLI_DLSITE_CACHE_DB / _CACHE_MAX_EXPANDED_BYTES / _CACHE_MAX_TRANSFER_BYTES / _CACHE_TTL_OK_MS / _CACHE_TTL_PARSE_ERROR_MS / _CACHE_TTL_NOT_FOUND_MS / _CACHE_TTL_ERROR_MS / _MAX_BACKOFF_MS / _OFFLINE / _REQUEST_INTERVAL_MS / _RETRY_COUNT / _TIMEOUT_MS / _USER_AGENT

（プレフィックスは起票時の MIMIKAGO_ から MIMIMILLI_ へリネーム済み）

実装は server/src/adapters/real/dlsiteCache.ts:111-147（DB・TTL 4種・転送/展開上限）と server/src/adapters/real/dlsiteConfig.ts:53-92（offline / interval / retry / backoff / timeout / UA）にパースとバリデーションがある。

単一ユーザー・単一運用形態のプロジェクトで実際に触る見込みがあるのは次の3つ程度。

- _OFFLINE（デバッグ用途）
- _REQUEST_INTERVAL_MS（DLsite側のレート制限対応）
- _CACHE_DB（データ配置の変更）

残りは定数化し、パース関数・バリデーション・エラーメッセージごと削除する。

## 着手時に決めること

- 残す環境変数を名前で確定する（「3つ程度」のままだと完了判定ができない）
- _USER_AGENT を残すかどうか。TASK-101 で「環境変数で設定可能にする」ことを目的に追加された経緯があるため、削るなら TASK-101 の意図を覆すことになる。判断と理由を記録すること

## ドキュメントの参照先が変わっている

起票時の docs/dlsite-cache.md は docs/dlsite.md へ統合済み。環境変数の一覧は docs/dlsite.md:115-126 にある。

なお server/src/dlsiteCacheCli.ts:22 のコメントにも古い docs/dlsite-cache.md 参照が残っているので、本タスクの対象に含める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 残す環境変数が名前で確定し、それ以外は定数化されている
- [ ] #2 _USER_AGENT を残すか削るかの判断と理由が記録されている（TASK-101 の意図との関係を含む）
- [ ] #3 TTLの既定値と outcome 4分類の挙動が変わっていない
- [ ] #4 定数化した設定について、パース関数とバリデーションとエラーメッセージが削除されている
- [ ] #5 docs/dlsite.md から削除した環境変数の記述が落ちている
- [ ] #6 server/src/dlsiteCacheCli.ts:22 の古い docs/dlsite-cache.md 参照が修正されている
<!-- AC:END -->
