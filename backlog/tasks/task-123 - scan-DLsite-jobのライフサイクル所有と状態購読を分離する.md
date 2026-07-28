---
id: TASK-123
title: scan/DLsite jobのライフサイクル所有と状態購読を分離する
status: To Do
assignee: []
created_date: '2026-07-28 16:27'
updated_date: '2026-07-28 16:27'
labels: []
dependencies: []
priority: medium
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109 完了後の総合レビュー（Fable が検出、GPT-5.6-Sol が構造を精緻化、Fable が配置の落とし穴を発見）。

問題:
App.tsx が useScanJob と useDlsiteBulk を保持しているため、スキャン実行中の SSE 進捗イベントごと、DLsite 一括取得の進捗イベントごとに App が再レンダリングされ、memo ゼロ設計のため全ツリーへ波及する。

重要（スコープの実態）:
useScanJob / useDlsiteBulk はローカル useState ＋自前 EventSource で多重購読できない。表示側ごとに hook を起動すると EventSource や完了処理が多重化する。単なる購読降ろしではなく所有構造の再設計になる。

配置の落とし穴（Fable が発見、実コードで確認済み）:
App.tsx は isSetupDone が false のとき SetupScreen を early return しており、AppShell はマウントされない。一方 SetupScreen は scanJob.scanning / scanProgressLabel / scanJob.error / handleCancelScan を消費する。したがって scan runtime を PlayerRuntime と同じく AppShell の overlays に置くと、初回セットアップのスキャンが壊れる。配置はセットアップ分岐より上（App ルート直下か Providers 側）にすること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スキャン実行中の SSE 進捗イベントで App が再レンダリングされない
- [ ] #2 DLsite 一括取得の進捗イベントで App が再レンダリングされない
- [ ] #3 EventSource が1つだけ生成される
- [ ] #4 terminal callback が1回だけ呼ばれる
- [ ] #5 アンマウント時に cleanup される
- [ ] #6 初回セットアップ時のスキャン（SetupScreen 経路）が従来どおり動作する
- [ ] #7 スキャン・一括取得の表示と操作が従来どおり
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. feature-scoped な runtime / provider が SSE の単一インスタンスを所有する構造にする（PlayerRuntime と同型の null コンポーネントが候補）
2. 配置はセットアップ分岐より上（App ルート直下か Providers 側）。AppShell の overlays に置くと SetupScreen 経路でスキャンが壊れる
3. 状態を atom 化し、表示側（TopBar・各モーダル・Toast・SetupScreen）は進捗状態だけを購読する
4. Toast / SetupScreen の配線も対象
5. テスト: EventSource が1つだけ生成されること、terminal callback が1回だけ呼ばれること、アンマウント時の cleanup、初回セットアップ経路のスキャン
<!-- SECTION:PLAN:END -->
