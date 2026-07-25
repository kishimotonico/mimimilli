---
id: TASK-99
title: DLsiteの環境変数を運用で実際に触るものだけに絞る
status: To Do
assignee: []
created_date: '2026-07-25 23:34'
labels: []
dependencies: []
priority: low
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

DLsite関連の環境変数が12個ある。

`MIMIKAGO_DLSITE_CACHE_DB` / `_CACHE_MAX_EXPANDED_BYTES` / `_CACHE_MAX_TRANSFER_BYTES` / `_CACHE_TTL_OK_MS` / `_CACHE_TTL_PARSE_ERROR_MS` / `_CACHE_TTL_NOT_FOUND_MS` / `_CACHE_TTL_ERROR_MS` / `_MAX_BACKOFF_MS` / `_OFFLINE` / `_REQUEST_INTERVAL_MS` / `_RETRY_COUNT` / `_TIMEOUT_MS`

単一ユーザー・単一運用形態のプロジェクトで実際に触る見込みがあるのは次の3つ程度。

- `_OFFLINE`（デバッグ用途）
- `_REQUEST_INTERVAL_MS`（DLsite側のレート制限対応）
- `_RETRY_COUNT`（同上）

残りはサイズ上限・バックオフ・タイムアウト・DBパス・TTLで、既定値のまま運用される見込みが高い。それぞれに専用のパース関数・バリデーション・エラーメッセージ・docs記載の保守コストがかかっている。

また `_CACHE_TTL_PARSE_ERROR_MS` は `_CACHE_TTL_ERROR_MS` と既定値が同一で、独立して変える場面が想像しにくい。

## やること

実運用で触る見込みのある3つ（またはそれに近い最小集合）だけを環境変数として残し、残りは定数のハードコードに戻す。値そのものは変えないので挙動は変わらない。削れるのはパース・バリデーション・docs記述の保守コスト。

TTLの既定値（ok=30日 / parse_error=1時間 / not_found=3日 / error=1時間）と outcome 4分類そのものは維持する。分類はHTML保持要否という意味を持っており、削減対象ではない。

`docs/dlsite-cache.md` から削除した環境変数の記述を落とすこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 実運用で触る見込みのある環境変数だけが残り、残りは定数化されている
- [ ] #2 TTLの既定値と outcome 4分類の挙動が変わっていない
- [ ] #3 定数化した設定について、パース関数とバリデーションとエラーメッセージが削除されている
- [ ] #4 docs/dlsite-cache.md から削除した環境変数の記述が落ちている
<!-- AC:END -->
