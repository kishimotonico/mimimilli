---
id: TASK-22
title: oxlint/oxfmtの導入とチェック体制の整備
status: Done
assignee:
  - '@claude'
created_date: '2026-07-06 01:50'
updated_date: '2026-07-06 02:18'
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
- [x] #1 ルートdevDependenciesにoxlint/oxfmtを追加し、pnpm lint / pnpm fmt / pnpm fmt:check スクリプトを定義する
- [x] #2 .oxlintrc.jsonでreact/react-hooks/jsx-a11yプラグインを有効化し、pnpm lintが全workspace（client/server/shared）を対象に通る
- [x] #3 全ファイルをoxfmtで一括フォーマットし、独立コミットとして分離する（設定導入コミットとは分ける）
- [x] #4 pnpm checkにlintとfmt:checkを組み込み、pnpm check・pnpm testが通る状態を保つ
- [x] #5 AGENTS.mdの実装方針に共通DoD（typecheck/lint/fmt:check/テスト通過）を明記する
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodex（codex exec, thread 019f351f-f6e0-7122-822f-9ff65ae3140d）に委譲し、コミット以降とレビュー・検証はClaudeが実施。

決定事項・所見:
- oxlint 1.72.0 / oxfmt 0.57.0 を導入。oxlintでは react-hooks は独立プラグインでなく react プラグインに統合されている（react/exhaustive-deps 等）
- jsx-a11y対応で行系UI（WorkRow/AxisColumn/FileRow/ContentColumn/DrillHeader/FullScreenPlayerトラック行）を div→button 化。UA既定の text-align: center により行テキストが中央寄せになる回帰が発生したため、shell.css の .mle-app button ベースリセットに text-align: inherit を追加して一括解消（agent-browserで全画面プレイヤー・ライブラリ・ファイルモード・設定モーダルを目視確認済み）
- この回帰は test:visual が検出できなかった。maxDiffPixelRatio: 0.03（フルページで約4万px）が寄せズレ程度の差分を許容してしまうため。フォローアップとして TASK-23 を起票
- Tag.tsx は onClick と onRemove 併用時は span のまま onClick が付かない実装（ネストボタン回避）。現状併用箇所はないが、TASK-4（タグ削除UX）着手時に要考慮

検証結果: pnpm check（tsc×3 + lint + fmt:check）通過、pnpm test 146件通過、test:visual 6件通過
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
oxlint/oxfmtを導入しcheckスクリプトに統合（コミット2件: 導入+lint修正 / 一括フォーマット）。jsx-a11y違反はdiv→button化等のコード修正で解消し、button化に伴うtext-align回帰はベースリセットで対処。AGENTS.mdに共通DoDを明記。check/test/test:visual全通過を確認済み
<!-- SECTION:FINAL_SUMMARY:END -->
