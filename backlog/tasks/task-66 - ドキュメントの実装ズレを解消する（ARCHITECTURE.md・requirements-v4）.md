---
id: TASK-66
title: ドキュメントの実装ズレを解消する（ARCHITECTURE.md・requirements-v4）
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 03:08'
updated_date: '2026-07-19 03:21'
labels: []
dependencies: []
modified_files:
  - docs/ARCHITECTURE.md
  - docs/requirements-v4.md
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー(2026-07-19)指摘24。docs/ARCHITECTURE.md:55が「SSEによる進捗配信は未実装」と記載しているが、server/src/routes/scanProgress.ts で実装済み。docs/requirements-v4.md:179,252,473 はレジューム・A-Bリピート・MediaSession・再生速度等を将来扱いのままにしているが実装済み。グリッドの記述も現実装とズレ。

対応: メンテ対象docsの方針（追記でなく書き換えで現在の状態だけを保つ）に従い、実装済み機能の記述を現状に合わせて更新する。要件docは「現在保証する仕様」と「候補」を区別する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ARCHITECTURE.mdのSSE・検索処理方式などの記述が現実装と一致する
- [x] #2 requirements-v4.mdで実装済み機能（レジューム・A-Bリピート・MediaSession・再生速度・グリッド表示）が現状扱いになっている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 対象機能の実装と現行ドキュメントを照合する
2. ARCHITECTURE.mdをSSEと検索方式の現状に合わせて書き換える
3. requirements-v4.mdをレジューム・A-Bリピート・MediaSession・再生速度・グリッド表示の現状に合わせて書き換える
4. Markdownと全体チェックを確認する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SSE、レジューム、A-Bリピート、Media Session API、再生速度、Libraryグリッドを実装から確認して現在保証する仕様へ書き換えた。関連して文書内で矛盾していた移動追従とFile Explorerも現状化した。docs/README.mdは文書の配置・役割に変更がないため更新不要。検証: pnpm check / pnpm test 成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ARCHITECTURE.mdとrequirements-v4.mdを現在実装に合わせ、実装済み仕様と将来候補を分離した。pnpm checkとpnpm testで検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
