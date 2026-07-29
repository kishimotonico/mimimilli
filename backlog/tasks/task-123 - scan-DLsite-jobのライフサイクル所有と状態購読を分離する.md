---
id: TASK-123
title: scan/DLsite jobのライフサイクル所有と状態購読を分離する
status: To Do
assignee: []
created_date: '2026-07-28 16:27'
updated_date: '2026-07-29 15:49'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
【引き継ぎ用の文脈】TASK-109 系リファクタと、その後の総合レビュー（GPT-5.6-Sol / Fable の独立2件）を経て起票した4課題の最後の1件。TASK-120 / 121 / 122 は完了済み。

■ なぜ単なる購読降ろしでは済まないか
useScanJob / useDlsiteBulk はローカル useState ＋自前 EventSource で実装されており、多重購読できない。表示側（TopBar・各モーダル・Toast・SetupScreen）がそれぞれ hook を呼ぶと EventSource と完了処理が多重化する。したがって「App から購読を降ろす」ではなく「単一所有者を作り、表示側は状態だけを購読する」という所有構造の再設計になる。

■ 配置の落とし穴（実コードで検証済み）
App.tsx は isSetupDone が false のとき SetupScreen を early return する（App.tsx:247-256 付近）。この分岐では AppShell がマウントされない。一方 SetupScreen は scanJob.scanning / scanProgressLabel / scanJob.error / handleCancelScan を消費する。
したがって scan runtime を PlayerRuntime と同じく AppShell の overlays に置くと、初回セットアップのスキャンが壊れる。配置はセットアップ分岐より上（App ルート直下か Providers 側）にすること。

■ この一連の作業で確立した進め方
- 実装は Cursor（cursor-impl スキル）へ委譲し、統括はレビュー・検証・コミット・進行管理に専念する
- 「通るだけのテスト」を作らない。テストを書いたら必ず一度わざと旧実装へ戻して失敗することを確認し、失敗メッセージを報告に残す
- 再描画の実測は一時計装（window.__rc への積算）で行い、陰性対照と陽性対照を必ず併せて取る。計測後は計装を撤去して git diff に痕跡を残さない
- agent-browser の react renders プロファイラは祖先を過剰カウントするため受け入れ判定に使わない
- React.StrictMode 有効なので計装値は論理レンダー数の2倍になる。回数は固定値でなく基準値からの増減で検証する

■ 過去に踏んだ罠
- satisfies readonly (keyof T)[] は配列のキー欠落を検出しない。網羅性を型で担保するならマップドタイプを使う（オブジェクトリテラルなら必須キー欠落が代入不可になる）
- 前回値キャッシュ等をモジュールグローバルに置くと、テストの複数 store 間で干渉する。インスタンス単位（useRef）に置く
- TanStack Query の tracked properties により、フックを呼んでも戻り値を使わないと再描画が起きない。検出力確認で購読を戻す実験をするときは戻り値を実際に使う形にする
- 購読退行テストは観測境界の選び方で検出範囲が決まる。App を境界にすると中間層（PlayerDock 等）の退行は検出できない

■ 既存の退行防止テスト
- client/tests/unit/appRootSubscriptions.test.tsx: 実物の App を描画し AppShell を vi.mock で差し替えて呼び出し回数を数える。player / notification summary / 検索 の非購読と、settings クエリ更新での再描画（陽性対照）を検証
- client/tests/unit/playerDockSubscriptions.test.tsx: 中間層の観測境界
本タスクでも scan/dlsite 進捗での App 非再描画を appRootSubscriptions.test.tsx に追加するのが自然

■ Cursor 実行時の注意
呼び出し元セッションの終了時に cursor-agent が道連れで殺される事象が頻発する。stream-json の system 行から session_id を控えておき、中断されたら cursor-agent -p --resume <session_id> で文脈ごと再開する。追跡対象コマンド内で & によるバックグラウンド化をしないこと（ラッパー終了時に子も片付けられる）。1回の依頼は実装／テスト／検証で区切ると被害が小さい
<!-- SECTION:NOTES:END -->
