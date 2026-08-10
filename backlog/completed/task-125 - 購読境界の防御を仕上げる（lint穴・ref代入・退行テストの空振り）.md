---
id: TASK-125
title: 購読境界の防御を仕上げる（lint穴・ref代入・退行テストの空振り）
status: Done
assignee: []
created_date: '2026-07-29 18:03'
updated_date: '2026-07-30 07:38'
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
- [x] #1 appRootSubscriptions.test.tsx に Jotai 経路の陽性対照が追加され、App 配下の購読が store と繋がっていることを検証している
- [x] #2 App.tsx から購読フックモジュール（usePlayerState 等）を import すると lint が落ちる
- [x] #3 ScanRuntime のレンダー中 ref 代入が解消され、player 側と作法が揃っている
- [x] #4 runtimeEventSource.test.tsx が実際の Provider 構成で ScanRuntime → dlsiteBulk.attach の連携を検証している
- [x] #5 追加・変更した各テストが、対応するガードを一時的に外すと失敗することを確認し、失敗メッセージを実装ノートに記録している
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. D: appRootSubscriptions.test.tsx に JotaiSubscriptionProbe（playerCoreAtomを購読しrender回数を数える）を追加し、store.set で再描画されることを検証する陽性対照を新設（Query経路の陽性対照とは別ブロック）。
2. B: .oxlintrc.json の override files を "client/src/app/App.tsx"（未マッチのバグ）から "**/App.tsx" へ修正し、no-restricted-imports.patterns を deny-by-default（**/features/**/model/**）+ 否定glob（usePlayerActions/useScanActions/useDlsiteBulkActions/files/model/types）へ変更。
3. C: ScanRuntime.tsx の scanJobRef.current = scanJob をレンダー中代入から useLayoutEffect へ移動（usePlayer.ts:36 と同一作法）。
4. E: runtimeEventSource.test.tsx に ScanRuntime + DlsiteBulkRuntime を同一Provider上に描画し、newWorkIds非空の完了イベントで dlsiteBulk.attach が実際に成立する（dlsiteBulkActiveAtom=true、EventSourceが1つ増える）ことを検証するテストを追加。
5. 追加・変更したテスト（D, E）とBのlintガードについて、それぞれ一時的にガードを外して失敗することを確認し、実装ノートに記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
着手順: TASK-124（App の Query 購読降ろし）を先に片付けてから着手するのが望ましい。124 が App の再レンダリング源を断ち切る本体で、本タスクはその周りの防御を固めるもの。ただし依存関係はないので独立に着手しても破綻はしない。

重要度の扱い: 4件それぞれは単体なら Low だが、D（退行テストの空振り）だけは今回追加したテスト4本を将来まるごと無効化しうるため、バンドル全体を Medium とした。分割せず1タスクにまとめたのは、4件とも実装が小さく1PRで完結し、分割すると管理コストが勝ると判断したため（レビュー時の合議）。AC の先頭に D を置いてあるのはこの理由による。

着手順（2026-07-30 の方針レビューで決定）: TASK-110 → TASK-111 → TASK-124 → TASK-125。

AC の4項目（Jotai 購読を検出する陽性対照 / Oxlint 境界 / render 中の ref 代入解消 / Runtime 間連携テスト）は、TASK-124 の単純な後処理ではなくそれぞれ独立した受け入れ条件として扱うこと。124 が終われば自動的に満たされるものは一つもない。

実装完了。変更ファイル: client/tests/unit/appRootSubscriptions.test.tsx, client/tests/unit/runtimeEventSource.test.tsx, .oxlintrc.json, client/src/features/scan/ui/ScanRuntime.tsx

D: JotaiSubscriptionProbe（playerCoreAtom購読）を追加し、store.set(playerCoreAtom, ...) で再描画されることを検証する陽性対照テストを新設。
破壊確認: renderApp内のJotaiProvider storeをuseMemo(() => createStore(), [])（=返り値と異なる別storeを渡す規約違反）に変えたところ、新設した陽性対照テストのみ失敗（他の10件は変化なし）。
失敗メッセージ: `AssertionError: expected 2 to be greater than 2` （jotaiProbeRenderCount が baseline と同値のまま）。復元済み。

B: .oxlintrc.jsonのoverrides[].filesが "client/src/app/App.tsx" だと `oxlint --deny-warnings client server shared` 実行時に一致しない実装上の癖があり、既存の禁止ルール自体が発火していなかったことを確認（App.tsxにusePlayerStateをimportしてもwarningのみでlint成功）。files を "**/App.tsx" に変更したところ発火するようになった。
patterns.groupの否定glob（!から始まるgroup要素）はoxlint 1.72.0で機能することを実機確認済み。deny-by-default（**/features/**/model/**）+ usePlayerActions/useScanActions/useDlsiteBulkActions/files/model/typesの否定globで、App.tsxの既存3importを許可しつつ、それ以外の購読フックimportを拒否できることを確認。
破壊確認: App.tsxへ `import { usePlayerState } from "../features/player/model/usePlayerState";` を追記してpnpm lintを実行。
失敗メッセージ: ``client/src/app/App.tsx:240:1: error eslint(no-restricted-imports): '../features/player/model/usePlayerState' import is restricted from being used by a pattern. help: App.tsx は features/*/model 配下を import しない（action フック・型モジュールのみ許可）``。復元済み、pnpm lint再度クリーン確認済み。

C: scanJobRef.current = scanJob をレンダー中代入から useLayoutEffect(() => { scanJobRef.current = scanJob; }, [scanJob]) へ変更。usePlayer.ts:36と同一作法。専用の破壊確認テストはなし（既存のrenderRuntime系テストはact()内で同期実行されるため差が出ない。TASK-125のAC#5は追加・変更したテスト対象であり、Cはテスト変更を伴わないコード整形のため対象外と判断）。

E: runtimeEventSource.test.tsx に「Runtime間連携: ScanRuntime → DlsiteBulkRuntime」を追加。ScanRuntimeとDlsiteBulkRuntimeを同一Provider（同一queryClient/store）上に描画し、newWorkIds非空の完了イベントをディスパッチしてdlsiteBulkActiveAtomがtrueになり、EventSourceが2つ目（/api/dlsite/events）生成されることを検証。
破壊確認: ScanRuntime.tsx の `if (result.newWorkIds.length > 0) dlsiteBulk.attach();` を一時的にコメントアウトして実行。
失敗メッセージ: `AssertionError: expected false to be true // Object.is equality`（store.get(dlsiteBulkActiveAtom) がfalseのまま）。復元済み。

pnpm check: 全通過（tsc x3, oxlint, oxfmt --check）。
pnpm test: server 344 pass / client 350 pass（新規1件を含む）、fail 0。

検証担当が破壊テスト3件を独立再実行しすべて実装担当の報告と一致: B は usePlayerState / useDlsiteNotificationSummary / atoms直import / jotai useAtomValue の4種の import 追記でそれぞれ no-restricted-imports エラーを確認、許可リストは現状の App.tsx の import が lint クリーンで通ることを確認。D は store を別物にすると新設陽性対照のみが expected 2 to be greater than 2 で失敗。E は attach() コメントアウトで新設テストのみが expected false to be true で失敗。**/App.tsx の誤爆リスクはリポジトリ内に App.tsx が1つのみで実質ゼロ。C は scanJobRef.current の読み取りがコミット後のアクションクロージャーのみでレンダー中読み取りなし。すべて完全復元済み、pnpm check / pnpm test（server 344 / client 350）全通過。重要な発見: 既存の files: ["client/src/app/App.tsx"] は oxlint の glob マッチングで一致せず既存ルール自体が発火していなかった（**/App.tsx 形式が必要）。TASK-122 の境界は実際には素通しだった。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-120〜123 レビューで見つかった防御の弱点4件を1PRで解消。D: appRootSubscriptions.test.tsx へ Jotai 経路の陽性対照を追加し store 配線ミスを検出可能に。B: 既存 Oxlint override の files 指定が glob 不一致で一切発火していなかった根本原因を修正（**/App.tsx 化）し、deny-by-default（features/**/model/** 禁止 + action 系の否定 glob 許可）へ強化。C: ScanRuntime のレンダー中 ref 代入を useLayoutEffect へ移し player 側と作法を統一。E: runtimeEventSource.test.tsx を実 Provider 構成での ScanRuntime → dlsiteBulk.attach 連携検証に強化。破壊テストは実装担当・検証担当が独立に実行し全件一致。
<!-- SECTION:FINAL_SUMMARY:END -->
