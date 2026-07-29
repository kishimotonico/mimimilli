---
id: TASK-125
title: 購読境界の防御を仕上げる（lint穴・ref代入・退行テストの空振り）
status: To Do
assignee: []
created_date: '2026-07-29 18:03'
updated_date: '2026-07-29 18:27'
labels: []
dependencies: []
priority: medium
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-120〜123 完了後の総合レビュー（Fable と Codex の独立2件を統合）で見つかった、対策そのものの弱点4件。いずれも実装は小さく、1PRで完結する。単体では Low だが、D（退行テストの空振り）が今回追加したテストを将来まるごと無効化しうるため、バンドル全体としては Medium 扱いにする。

D. appRootSubscriptions.test.tsx に Jotai 経路の陽性対照がない（この中では最も重い）
陽性対照が queryClient.setQueryData しか検証していない（appRootSubscriptions.test.tsx:168-173）。テストは createStore() した store を JotaiProvider に渡し store.set(...) で「再描画されないこと」を見ているため、将来 App 配下が別ストアになると store.set がどこにも届かず、player / 検索 / scan / DLsite の陰性テスト4本が全部空振りで通る。対処は「App 配下の Jotai 購読プローブが store.set で再描画される陽性対照を1本追加」。Query の対照とは別に置く。
なお playerDockSubscriptions.test.tsx は baseline 取得（play で core 変化→カウント増）が陽性対照を兼ねており、こちらは問題なし。

B. Oxlint 境界の穴（実証済み）
.oxlintrc.json の禁止パターンが **/features/**/model/atoms と *Atoms、および jotai の useAtom / useAtomValue のみのため、購読フックモジュールが境界の外にいる。App.tsx へ usePlayerState や useDlsiteNotificationSummary を import しても pnpm lint が素通りする（Fable が実地確認、exit 0）。既存の useLibraryNavigation 等も同様。
塞ぎ方の第一候補は deny-by-default 型: **/features/**/model/** を丸ごと禁止し、App から使ってよい action 系（usePlayerActions / useScanActions / useDlsiteBulkActions / 型モジュール等）だけを否定 glob で許可する。穴が既定で閉じるため列挙漏れが起きない。oxlint の patterns が否定 glob に対応しているかは実装時に要確認で、不可なら列挙追加へフォールバックする。

C. ScanRuntime のレンダー中 ref 代入
ScanRuntime.tsx:36-37 の scanJobRef.current = scanJob がレンダー中に実行される。TASK-121 が player から排除したのと同じパターンの新規混入で、usePlayer.ts:36 は同じ更新を useLayoutEffect へ移している。同一コミット範囲内で作法が割れている状態。React 19 の並行レンダーが中断・破棄された場合に未コミットの scanJob を掴みうる（Codex 指摘）。実害は限定的だが useLayoutEffect 化1行で原則が揃う。

E. runtimeEventSource.test.tsx が Runtime 間連携を検証していない
ScanRuntime を単独描画し、かつ newWorkIds が空配列（runtimeEventSource.test.tsx:49）のため、ScanRuntime → dlsiteBulk.attach() の分岐に一度も入らない。TASK-123 で新規導入した Runtime 間依存（ScanRuntime が useDlsiteBulkActions を呼ぶ）が壊れても、あるいは別の Jotai Provider へ移動しても、このテストは通る。実際の Provider 構成で両 Runtime を描画し、newWorkIds が1件以上ある完了イベントで attach が一度だけ成立することを検証する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 appRootSubscriptions.test.tsx に Jotai 経路の陽性対照が追加され、App 配下の購読が store と繋がっていることを検証している
- [ ] #2 App.tsx から購読フックモジュール（usePlayerState 等）を import すると lint が落ちる
- [ ] #3 ScanRuntime のレンダー中 ref 代入が解消され、player 側と作法が揃っている
- [ ] #4 runtimeEventSource.test.tsx が実際の Provider 構成で ScanRuntime → dlsiteBulk.attach の連携を検証している
- [ ] #5 追加・変更した各テストが、対応するガードを一時的に外すと失敗することを確認し、失敗メッセージを実装ノートに記録している
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手順: TASK-124（App の Query 購読降ろし）を先に片付けてから着手するのが望ましい。124 が App の再レンダリング源を断ち切る本体で、本タスクはその周りの防御を固めるもの。ただし依存関係はないので独立に着手しても破綻はしない。

重要度の扱い: 4件それぞれは単体なら Low だが、D（退行テストの空振り）だけは今回追加したテスト4本を将来まるごと無効化しうるため、バンドル全体を Medium とした。分割せず1タスクにまとめたのは、4件とも実装が小さく1PRで完結し、分割すると管理コストが勝ると判断したため（レビュー時の合議）。AC の先頭に D を置いてあるのはこの理由による。

着手順（2026-07-30 の方針レビューで決定）: TASK-110 → TASK-111 → TASK-124 → TASK-125。

AC の4項目（Jotai 購読を検出する陽性対照 / Oxlint 境界 / render 中の ref 代入解消 / Runtime 間連携テスト）は、TASK-124 の単純な後処理ではなくそれぞれ独立した受け入れ条件として扱うこと。124 が終われば自動的に満たされるものは一つもない。
<!-- SECTION:NOTES:END -->
