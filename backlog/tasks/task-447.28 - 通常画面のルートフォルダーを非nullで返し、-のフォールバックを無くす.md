---
id: TASK-447.28
title: 通常画面のルートフォルダーを非nullで返し、?? "/" のフォールバックを無くす
status: To Do
assignee: []
created_date: '2026-09-11 08:34'
labels:
  - refactor
  - triage
dependencies:
  - TASK-447.21
parent_task_id: TASK-447
priority: high
ordinal: 501000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計負債の返上（TASK-447.21 のレビューで判明）。App.tsx の settings?.rootFolder ?? "/"、FilesBreadcrumbs.tsx・WorkDetail.tsx・FilePreview.tsx の useRootFolder() ?? "/" は、起動ゲートにより通常画面では root が必ずある前提なのに、前提が崩れたら黙って "/" を使う。AGENTS.md のフォールバック禁止に沿い、不変条件を型で表す。TASK-447.21 の取り込み後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 entities/settings に通常画面用の非nullのルートフォルダー取得フックがあり、settings 未取得・rootFolder 無しのときは throw する。nullable 版は起動ゲート（App の startupState 判定・SetupScreen）専用として名前で区別されている
- [ ] #2 通常画面のコンポーネントは非null版だけを使い、client/src で rootFolder の ?? "/"（および同種のルートフォルダーの既定値）が rg で0件
- [ ] #3 FilesView の rootFolder prop が外れ、FilesView が自分で非null版を読む
- [ ] #4 非null版の throw が RootErrorBoundary で起動状態の不整合として表示されることをテストで確認している
- [ ] #5 挙動は通常の画面では変わらず、既存テストの期待値を変えていない（テストの組み立ての変更はタスクメモに列挙）。pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->
