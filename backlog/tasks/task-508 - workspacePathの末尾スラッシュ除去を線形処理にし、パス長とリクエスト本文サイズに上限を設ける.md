---
id: TASK-508
title: workspacePathの末尾スラッシュ除去を線形処理にし、パス長とリクエスト本文サイズに上限を設ける
status: Done
assignee:
  - '@sonnet'
created_date: '2026-10-18 13:36'
updated_date: '2026-11-07 10:55'
labels:
  - security
  - server
  - shared
dependencies:
  - TASK-506
priority: low
ordinal: 566000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude SecurityスキャンのF9（ReDoS、LOW）。shared/src/media.ts の workspacePath が非アンカーの /\/+$/g で末尾スラッシュを削っており、末尾一致しない長い入力で二次時間になる。workspacePathSchemaに長さ上限もない。あわせてBun.serveのmaxRequestBodySizeを明示する。方針の正は CLAUDE-SECURITY-20261016-133939/fix-instructions.md の C。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 workspacePathの末尾スラッシュ除去が正規表現を使わない線形処理になり、既存の正規化（バックスラッシュ置換、末尾除去、絶対パス・.・..の拒否）の結果は変わらない
- [x] #2 workspacePathSchemaはtransformの前に長さ上限を検査し、超過は検証エラー（APIでは400）になる。上限値はWindowsの長いパスを含む正規の利用を確認して決め、根拠をNotesに残している
- [x] #3 Bun.serveにmaxRequestBodySizeを明示し、値は作品編集・一括操作など正規の本文サイズの実測を踏まえて決め、根拠をNotesに残している
- [x] #4 テストで、末尾一致しない長いスラッシュ列の入力が線形時間で処理されることと、長さ上限の境界を確認している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
上限値の根拠: WORKSPACE_PATH_MAX_LENGTH=4096。workspacePathはroot相対で、Windowsの長いパス(MAX_PATH 260超)でも各段は255文字以下、正規の深い階層でも数百文字。4096はMAX_PATHの約16倍で正規利用を十分に通し、線形化済みなので上限は入力コストの天井として置く。SERVER_MAX_REQUEST_BODY_BYTES=64MiB。最大の正規本文は候補の一括登録(scan/candidates/register)で、分割せず1リクエストで {path, rjCode} を送る。日本語パスはUTF-8で1文字3バイトのため、日本語100文字級のパスで約350B/件、64MiBで約19万件まで通る。上限はloopback限定サーバーのDoS緩和であり、client側の分割は入れない。Bun既定128MiBは過大。超過は実ソケットで413を確認。

レビュー判断: workspacePathSchemaの上限はレスポンスのパースにも効くが、root相対で各段255文字以下の実パスが4096文字を超えることは現実的でないため、リクエスト用とレスポンス用にスキーマを分けない。

マージ前レビュー(2026-11-07, Fable)の指摘で、shared の relativeToRoot と fixture の normalizeFsPath に残っていた非アンカーの末尾スラッシュ正規表現も trimTrailingSlashes に統一（5535ec38）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
末尾スラッシュ除去を線形処理（trimTrailingSlashes）に統一し、workspacePathは4096文字、リクエスト本文は64MiBを上限にした。pnpm check && pnpm test と smoke で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
