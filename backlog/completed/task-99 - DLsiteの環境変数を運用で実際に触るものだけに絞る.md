---
id: TASK-99
title: DLsiteの環境変数を運用で実際に触るものだけに絞る
status: Done
assignee:
  - '@claude'
created_date: '2026-07-25 23:34'
updated_date: '2026-08-02 16:09'
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
- [x] #1 残す環境変数が名前で確定し、それ以外は定数化されている
- [x] #2 _USER_AGENT を残すか削るかの判断と理由が記録されている（TASK-101 の意図との関係を含む）
- [x] #3 TTLの既定値と outcome 4分類の挙動が変わっていない
- [x] #4 定数化した設定について、パース関数とバリデーションとエラーメッセージが削除されている
- [x] #5 docs/dlsite.md から削除した環境変数の記述が落ちている
- [x] #6 server/src/dlsiteCacheCli.ts:22 の古い docs/dlsite-cache.md 参照が修正されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【2026-08-03 実装完了・AC#2の判断】_USER_AGENT は削除で確定。TASK-101はUAを実ブラウザ相当へ寄せることが本質で、環境変数化は付随手段だった。単一ユーザー運用でUAを外から差し替える運用実態がなく、変更が必要になったら定数 DEFAULT_DLSITE_USER_AGENT（dlsiteConfig.ts）を書き換えれば足りる。TASK-101の成果（UA文字列そのもの）は定数として維持されている。テストの注入はCLIの overrides 引数（maxExpandedBytes等）に置き換え、TTL既定値とoutcome4分類の挙動は不変。Cursor(composer-2.5)へ委譲、統括レビュー済み。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DLsite環境変数を _CACHE_DB/_OFFLINE/_REQUEST_INTERVAL_MS の3つに絞り、残り10個（TTL4種・転送/展開上限・retry/backoff/timeout/UA）を既定値そのままの定数へ置換。パース関数・バリデーション・該当テスト・docs/dlsite.mdの一覧を整理し、dlsiteCacheCliの古いdocs参照を修正。pnpm check・pnpm test（server 444/client 603）全パス。
<!-- SECTION:FINAL_SUMMARY:END -->
