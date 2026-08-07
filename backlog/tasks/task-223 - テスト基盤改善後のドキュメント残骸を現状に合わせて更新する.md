---
id: TASK-223
title: テスト基盤改善後のドキュメント残骸を現状に合わせて更新する
status: Done
assignee: []
created_date: '2026-08-07 07:16'
updated_date: '2026-08-07 07:22'
labels: []
dependencies: []
priority: medium
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pixel比較廃止→smoke一本化（TASK-221）とworktree分離（TASK-214/222）の後、ドキュメントに旧仕様の記述が残っている。AGENTS.md:30のpnpm test:visual記述（既知残件）、docs/HANDOFF.md:39の固定ポート4175、docs/HANDOFF.md:53のworktreeデータディレクトリ名。あわせて別件で発見したdocs/adr/0007-bun-distribution-runtime.md:33のLinuxデータディレクトリ名mimikagoも実装（mimimilli）に合わせて修正する。AGENTS.mdは未コミットの変更が作業ツリーに存在するため、worktreeではなくメインの作業ツリーで直接編集する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AGENTS.mdのテスト運用記述がtest:visualからtest:smokeへ更新され、docs/design-system.md:121の現行運用（レイアウトに関わる変更ではtest:smokeの結果を受け入れ条件に含める）と整合している
- [x] #2 docs/HANDOFF.mdのsmokeポート記述が固定4175ではなくworktreeパスのハッシュから4200〜4699を決定的に導出する現行実装（client/playwright.config.ts）と整合している
- [x] #3 docs/HANDOFF.mdのworktreeデータディレクトリ名の記述が<basename>-<絶対パスsha256先頭8桁>形式（scripts/dev-real.mjs）と整合している
- [x] #4 docs/adr/0007のLinuxデータディレクトリ名がmimimilli（server/src/adapters/real/dataRoot.tsの実装）に合わせて修正されている
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
AGENTS.mdのtest:visual記述をtest:smokeの現行運用へ更新、docs/HANDOFF.mdのsmokeポート（4175固定→worktreeパスsha256から4200〜4699導出）とworktreeデータディレクトリ名（<basename>-<絶対パスsha256先頭8桁>）を実装に整合、docs/adr/0007のmimikago表記（MIMIKAGO_DATA_DIR・Mimikago含む）をmimimilliへ修正。実装ファイルとの突き合わせレビュー（Sonnet）で問題なし。pnpm check全緑。コミット8ec445e。
<!-- SECTION:FINAL_SUMMARY:END -->
