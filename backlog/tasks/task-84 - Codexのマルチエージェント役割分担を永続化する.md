---
id: TASK-84
title: Codexのマルチエージェント役割分担を永続化する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-22 15:54'
updated_date: '2026-07-22 16:16'
labels: []
dependencies: []
modified_files:
  - AGENTS.md
  - .codex/config.toml
  - .codex/agents/implementer.toml
  - .codex/agents/verifier.toml
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
このリポジトリで、Solを進行管理、Terraを実装、Lunaを検証に使う運用をCodexのプロジェクト設定として永続化する。会話ごとの指示に依存せず、新しいセッションでも同じ責務分担を適用できる状態にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AGENTS.mdにSol・Terra・Lunaの責務と委任フローが明記されている
- [x] #2 プロジェクトスコープのCodexカスタムエージェントとしてTerra実装担当とLuna検証担当が定義されている
- [x] #3 Luna検証担当にtypecheck・lint・fmt:check・テスト・agent-browserによる必要なUI検証が割り当てられている
- [x] #4 設定ファイルがTOMLとして構文解析でき、空ファイルだった.codexが正しいディレクトリ構成へ置き換わっている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 現行Codex仕様と利用可能なモデルIDを確認する\n2. .codexをディレクトリ化し、共通設定と実装・検証エージェントを定義する\n3. AGENTS.mdに恒久的な委任ルールと修正ループを追記する\n4. 別エージェントが設定構文と役割分担を検証する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Terra実装担当がAGENTS.mdへCodex利用時に限定した役割分担を追加し、別スレッドの低推論Terraが独立検証した。git diff --checkは成功。ローカルモデルキャッシュでgpt-5.6-lunaの利用可能性も確認済み。\n\n.codexはこのCodexセッションで読み取り専用tmpfsとしてマウントされている。通常編集はDevice or resource busyとなり、マウント解除の権限昇格もサンドボックス保護の回避として拒否されたため、config.tomlとagents/*.tomlは未作成。迂回操作は行わない。

ユーザーが.codexディレクトリを作成後、Terra実装担当がconfig.tomlとimplementer/verifier定義を作成した。別スレッドの検証担当がCodex CLI 0.145.0のstrict-configで設定受理を確認し、モデルカタログ上のTerra medium/Luna low対応も確認した。現セッションのspawn APIはLuna指定を拒否したため、検証は合意済みフォールバックのTerra lowで実施した。対象ファイルは.git/info/excludeによりローカルGitでは無視されているため、コミット時は明示的なforce addが必要。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Solを統括、Terraを実装、Lunaを検証に割り当てるCodexプロジェクト設定を追加した。現行CLIのstrict-configと独立検証で設定を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
