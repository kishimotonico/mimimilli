---
id: TASK-22
title: oxlint/oxfmtの導入とチェック体制の整備
status: In Progress
assignee:
  - "@claude"
created_date: "2026-07-06 01:50"
updated_date: "2026-07-06 01:51"
labels:
  - dx
dependencies: []
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

リポジトリにはlinter/formatterが未導入で、checkスクリプトはtscのみ。Codexへの実装委譲を始める前にコードスタイルを機械的に統一・検証できる体制を作る。ESLint/Prettierの遺産がないため、oxc系（oxlint + oxfmt）をまっさらに導入する。oxfmtはベータだがPrettierのJS/TS互換100%・import並び替え内蔵で実用段階。型認識lint（oxlint-tsgolint）は本タスクの範囲外とし、必要になったら別タスクで導入する。

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ルートdevDependenciesにoxlint/oxfmtを追加し、pnpm lint / pnpm fmt / pnpm fmt:check スクリプトを定義する
- [ ] #2 .oxlintrc.jsonでreact/react-hooks/jsx-a11yプラグインを有効化し、pnpm lintが全workspace（client/server/shared）を対象に通る
- [ ] #3 全ファイルをoxfmtで一括フォーマットし、独立コミットとして分離する（設定導入コミットとは分ける）
- [ ] #4 pnpm checkにlintとfmt:checkを組み込み、pnpm check・pnpm testが通る状態を保つ
- [ ] #5 AGENTS.mdの実装方針に共通DoD（typecheck/lint/fmt:check/テスト通過）を明記する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. ルートにoxlint/oxfmtをdevDependenciesとして追加（pnpm add -Dw）
2. ルートpackage.jsonに lint / fmt / fmt:check スクリプトを定義し、checkに組み込む
3. .oxlintrc.jsonを作成しreact/react-hooks/jsx-a11yプラグインを有効化
4. pnpm lintを実行し、既存コードの違反を修正（自明でない違反はルール無効化でなく修正を優先）
5. 設定導入＋lint修正を1コミット目として作成
6. oxfmtで全ファイル一括フォーマットし、2コミット目として分離
7. AGENTS.mdに共通DoD（typecheck/lint/fmt:check/テスト通過）を明記
8. pnpm check / pnpm testで最終確認

実装はCodex（codex-impl）へ委譲し、検証と完了処理はClaudeが行う

<!-- SECTION:PLAN:END -->
